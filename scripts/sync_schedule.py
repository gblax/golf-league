#!/usr/bin/env python3
"""
Sync the league's tournaments table with Slash Golf's PGA schedule.

Primary job (safe, the common case): map each existing DB tournament onto its
Slash Golf event and record the ``slashgolf_tourn_id`` (so the Monday scorer
maps by ID, not a runtime name lookup) and the real ``prize_pool`` (the PGA
purse shown in the app).

Optional ``--create`` inserts schedule events that have no matching DB
tournament yet — this is how a NEW SEASON gets loaded (see
docs/handoff/season-rollover.md). New rows are stamped with ``season`` (the
``--year``) and numbered sequentially by start date in the league's own
``week`` scheme, continuing after that season's highest existing week (so a
brand-new season runs 1..N). ``picks_lock_time`` defaults to first-round
tee-off — review before relying on it. The full PGA calendar has more events
than the league plays (opposite-field events, the fall series), so prune the
extras afterwards and run ``--renumber`` to close the gaps.

Optional ``--renumber`` rewrites a season's ``week`` numbers as 1..N in date
order. It refuses to run once that season has picks (week numbers are how
members recognise results), unless ``--force``.

Always dry-run first.

Usage:
    python sync_schedule.py                        # dry run, current season
    python sync_schedule.py --year 2027            # dry run, explicit season
    python sync_schedule.py --apply                # write tournId + purse onto matches
    python sync_schedule.py --year 2027 --apply --create     # load next season
    python sync_schedule.py --year 2027 --apply --renumber   # weeks -> 1..N by date
"""

import sys
from datetime import datetime, timezone

import slashgolf
from golf_common import get_supabase_client, season_of
from slashgolf import normalize_name, tournament_names_match

ORG_ID = slashgolf.DEFAULT_ORG_ID


def _iso(ms):
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()


def match_event(tournament, events, by_norm):
    """Find the schedule event for a DB tournament: exact normalized name
    first, then the looser tournament_names_match."""
    ev = by_norm.get(normalize_name(tournament["name"]))
    if ev:
        return ev
    return next((e for e in events if tournament_names_match(e["name"], tournament["name"])), None)


# ---------------------------------------------------------------------------
# Week numbering (pure — unit-tested in test_sync_schedule.py)
# ---------------------------------------------------------------------------
def assign_weeks(existing_weeks, events):
    """League week numbers for events about to be created.

    Events are ordered by start date (name as a tiebreak) and numbered
    consecutively after the highest week already present in that season —
    so an empty season yields 1..N, and events added to a season that already
    has rows slot in after them rather than colliding.

    Slash Golf's own ``weekNumber`` (the PGA calendar week) is deliberately NOT
    used: the league's week is a sequence over the events it plays, and the
    calendar week leaves gaps wherever the league skips an event.
    """
    start = max(existing_weeks) if existing_weeks else 0
    ordered = sorted(events, key=lambda e: (e.get("start_ms") or 0, e.get("name") or ""))
    return [(start + i + 1, e) for i, e in enumerate(ordered)]


def renumber_weeks(rows):
    """Plan a 1..N renumbering of a season's tournaments in date order.

    Returns ``[(row, new_week)]`` for the rows whose week would change; an
    already-sequential season yields an empty list. Same-day events (there
    shouldn't be any once the extras are pruned) tie-break on name so the
    result is deterministic.
    """
    ordered = sorted(rows, key=lambda t: (str(t.get("tournament_date") or ""), t.get("name") or ""))
    return [(t, i + 1) for i, t in enumerate(ordered) if t.get("week") != i + 1]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def sync_schedule(year, apply=False, create=False, renumber=False, force=False):
    supabase = get_supabase_client()
    season = int(year)

    db = supabase.table("tournaments").select("*").execute().data or []
    db_this_season = [t for t in db if season_of(t) in (season, None)]
    print(f"DB tournaments in season {season}: {len(db_this_season)}")

    # --- Optional: renumber weeks 1..N by date (no API call needed) ---
    if renumber:
        plan = renumber_weeks(db_this_season)
        print(f"\n{'=' * 60}\nWeek renumbering ({len(plan)} change(s)):\n{'=' * 60}")
        for t, new_week in plan:
            print(f"  {t['name']}: week {t.get('week')} -> {new_week}")
        if plan and apply:
            ids = [t["id"] for t in db_this_season]
            picks = supabase.table("picks").select("id").in_("tournament_id", ids).limit(1).execute().data or []
            if picks and not force:
                print("\n" + "!" * 60)
                print(f"SEASON {season} ALREADY HAS PICKS — refusing to renumber weeks.")
                print("Members know their results by week number; changing them mid-season")
                print("rewrites history. Use --force only if you're sure.")
                print("!" * 60)
                return False
            # Two passes through a temporary offset: `week` isn't unique in
            # the schema today, but a future constraint shouldn't break this.
            for t, new_week in plan:
                supabase.table("tournaments").update({"week": new_week + 1000}).eq("id", t["id"]).execute()
            for t, new_week in plan:
                supabase.table("tournaments").update({"week": new_week}).eq("id", t["id"]).execute()
            print(f"  Renumbered {len(plan)} tournament(s).")
        elif not plan:
            print("  Weeks already run 1..N in date order. Nothing to do.")

    events = [e for e in slashgolf.parse_schedule(slashgolf.fetch_schedule(year, ORG_ID)) if e["tourn_id"]]
    by_norm = {}
    for e in events:
        by_norm.setdefault(normalize_name(e["name"]), e)
    print(f"Slash Golf schedule: {len(events)} events for season {year}")

    existing_ids = {str(t["slashgolf_tourn_id"]) for t in db if t.get("slashgolf_tourn_id")}
    matched_event_ids = set()
    updates = []  # (tournament, event, changes)

    for t in db_this_season:
        ev = match_event(t, events, by_norm)
        if not ev:
            continue
        matched_event_ids.add(ev["tourn_id"])
        changes = {}
        if str(t.get("slashgolf_tourn_id") or "") != ev["tourn_id"]:
            changes["slashgolf_tourn_id"] = ev["tourn_id"]
        purse = int(ev["purse"]) if ev["purse"] else 0
        if purse and purse != int(t.get("prize_pool") or 0):
            changes["prize_pool"] = purse
        if changes:
            updates.append((t, ev, changes))

    # --- Report + apply mapping updates ---
    print(f"\n{'=' * 60}\nMapping updates ({len(updates)}):\n{'=' * 60}")
    for t, ev, changes in updates:
        print(f"  '{t['name']}' (week {t.get('week')}) -> '{ev['name']}'")
        for k, v in changes.items():
            print(f"      {k}: {t.get(k)!r} -> {v!r}")
    if apply:
        for t, ev, changes in updates:
            supabase.table("tournaments").update(changes).eq("id", t["id"]).execute()
        print(f"  Applied {len(updates)} update(s).")

    # --- Optional: create unmatched events (= load a season) ---
    if create:
        to_create = [
            e for e in events
            if e["tourn_id"] not in matched_event_ids
            and e["tourn_id"] not in existing_ids
            and e["start_ms"]
        ]
        existing_weeks = [t["week"] for t in db_this_season if t.get("week") is not None]
        print(f"\n{'=' * 60}\nNew tournaments to create ({len(to_create)}) in season {season}:\n{'=' * 60}")
        rows = []
        for week, e in assign_weeks(existing_weeks, to_create):
            row = {
                "name": e["name"],
                "season": season,
                "week": week,
                "tournament_date": _iso(e["start_ms"]),
                "picks_lock_time": _iso(e["start_ms"]),
                "prize_pool": int(e["purse"]) if e["purse"] else None,
                "slashgolf_tourn_id": e["tourn_id"],
                "completed": False,
            }
            rows.append(row)
            print(f"  week {row['week']:>2}  {row['tournament_date'][:10]}  {row['name']}  "
                  f"(tournId={e['tourn_id']}, purse=${(row['prize_pool'] or 0):,})")
        if rows:
            print("\n  Review this list: the PGA calendar includes events the league may not play")
            print("  (opposite-field weeks, the fall series). Delete the extras in the Supabase SQL")
            print("  editor, then run --renumber so weeks run 1..N.")
        if apply and rows:
            supabase.table("tournaments").insert(rows).execute()
            print(f"  Inserted {len(rows)} tournament(s).")
        elif rows:
            print("  (--create is set but --apply is not; nothing inserted.)")

    if not apply:
        print("\n[DRY RUN] No changes made. Re-run with --apply to write.")
    return True


if __name__ == "__main__":
    args = sys.argv[1:]
    apply = "--apply" in args
    create = "--create" in args
    renumber = "--renumber" in args
    force = "--force" in args
    year = str(datetime.now(timezone.utc).year)
    if "--year" in args:
        year = args[args.index("--year") + 1]

    if not apply:
        print("Running in DRY RUN mode. Use --apply to write, --create to add new events, "
              "--renumber to close week gaps.\n")
    ok = sync_schedule(year, apply=apply, create=create, renumber=renumber, force=force)
    if not ok:
        sys.exit(1)
