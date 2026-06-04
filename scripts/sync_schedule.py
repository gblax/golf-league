#!/usr/bin/env python3
"""
Sync the league's tournaments table with Slash Golf's PGA schedule.

Primary job (safe, the common case): map each existing DB tournament onto its
Slash Golf event and record the ``slashgolf_tourn_id`` (so the Monday scorer
maps by ID, not a runtime name lookup) and the real ``prize_pool`` (the PGA
purse shown in the app).

Optional ``--create`` inserts schedule events that have no matching DB
tournament yet. Use with care: ``week`` is set from Slash Golf's PGA calendar
week number, which may differ from a league's own sequential week scheme, and
``picks_lock_time`` defaults to first-round tee-off — review before relying on
it. Always dry-run first.

Usage:
    python sync_schedule.py                 # dry run, current season
    python sync_schedule.py --year 2026     # dry run, explicit season
    python sync_schedule.py --apply         # write tournId + purse onto matches
    python sync_schedule.py --apply --create  # also insert unmatched events
"""

import sys
from datetime import datetime, timezone

import slashgolf
from golf_common import get_supabase_client
from slashgolf import normalize_name, tournament_names_match

ORG_ID = slashgolf.DEFAULT_ORG_ID


def _iso(ms):
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()


def _year_of(tournament):
    date_str = tournament.get("tournament_date")
    if date_str:
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00")).year
        except ValueError:
            return None
    return None


def match_event(tournament, events, by_norm):
    """Find the schedule event for a DB tournament: exact normalized name
    first, then the looser tournament_names_match."""
    ev = by_norm.get(normalize_name(tournament["name"]))
    if ev:
        return ev
    return next((e for e in events if tournament_names_match(e["name"], tournament["name"])), None)


def sync_schedule(year, apply=False, create=False):
    supabase = get_supabase_client()

    events = [e for e in slashgolf.parse_schedule(slashgolf.fetch_schedule(year, ORG_ID)) if e["tourn_id"]]
    by_norm = {}
    for e in events:
        by_norm.setdefault(normalize_name(e["name"]), e)
    print(f"Slash Golf schedule: {len(events)} events for season {year}")

    db = supabase.table("tournaments").select("*").execute().data or []
    db_this_year = [t for t in db if _year_of(t) in (int(year), None)]
    print(f"DB tournaments in scope: {len(db_this_year)}")

    existing_ids = {str(t["slashgolf_tourn_id"]) for t in db if t.get("slashgolf_tourn_id")}
    matched_event_ids = set()
    updates = []  # (tournament, event, changes)

    for t in db_this_year:
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

    # --- Optional: create unmatched events ---
    if create:
        to_create = [
            e for e in events
            if e["tourn_id"] not in matched_event_ids
            and e["tourn_id"] not in existing_ids
            and e["start_ms"] and e["week_number"]
        ]
        print(f"\n{'=' * 60}\nNew tournaments to create ({len(to_create)}):\n{'=' * 60}")
        rows = []
        for e in to_create:
            row = {
                "name": e["name"],
                "week": e["week_number"],
                "tournament_date": _iso(e["start_ms"]),
                "picks_lock_time": _iso(e["start_ms"]),
                "prize_pool": int(e["purse"]) if e["purse"] else None,
                "slashgolf_tourn_id": e["tourn_id"],
                "completed": False,
            }
            rows.append(row)
            print(f"  week {row['week']:>2}  {row['name']}  (tournId={e['tourn_id']}, purse=${(row['prize_pool'] or 0):,})")
        if apply and rows:
            supabase.table("tournaments").insert(rows).execute()
            print(f"  Inserted {len(rows)} tournament(s).")
        elif rows:
            print("  (--create is set but --apply is not; nothing inserted.)")

    if not apply:
        print("\n[DRY RUN] No changes made. Re-run with --apply to write.")


if __name__ == "__main__":
    args = sys.argv[1:]
    apply = "--apply" in args
    create = "--create" in args
    year = str(datetime.now(timezone.utc).year)
    if "--year" in args:
        year = args[args.index("--year") + 1]

    if not apply:
        print("Running in DRY RUN mode. Use --apply to write, --create to add new events.\n")
    sync_schedule(year, apply=apply, create=create)
