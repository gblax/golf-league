#!/usr/bin/env python3
"""
Golf League Results Updater

Fetches a finished tournament's leaderboard + earnings from Slash Golf
(RapidAPI "Live Golf Data") and updates Supabase. Processes picks across all
leagues, applying each league's own penalty settings, and records the
tournament's winning golfer.

Picks are matched to leaderboard entries by Slash Golf ``playerId`` (an exact
join). A deterministic normalized-name fallback covers legacy picks made
before golfer_id existed. There is no fuzzy matching and no tunable
"match rate" gate — both were artifacts of scraping ESPN, where names were the
only join key and schema drift could silently zero a whole field.

Which week to score is driven by OUR schedule (the most recent ended-but-
incomplete tournament), never by whatever event the API happens to surface.
If a tournament can't be mapped or results aren't final, the commissioner can
still override results manually through CommissionerTab in the web app.
"""

import sys
from datetime import datetime, timedelta, timezone

import slashgolf
from golf_common import get_supabase_client
from slashgolf import normalize_name, tournament_names_match

# orgId 1 = PGA Tour.
ORG_ID = slashgolf.DEFAULT_ORG_ID


# ---------------------------------------------------------------------------
# Tournament selection (schedule-driven) + Slash Golf event mapping
# ---------------------------------------------------------------------------
def get_tournament_to_update(supabase):
    """Pick which tournament a run should score: the most recent one that has
    finished play but isn't marked completed yet.

    The league's own calendar decides the target week, NOT whatever event the
    API is showing. Tournaments are shared across all leagues. Returns None
    when nothing has both ended and is still pending (an off week, or
    everything is already scored).
    """
    response = (
        supabase.table("tournaments")
        .select("*")
        .eq("completed", False)
        .order("week", desc=True)
        .execute()
    )
    if not response.data:
        return None

    now = datetime.now(timezone.utc)
    # Ordered week-DESC, so the first ended-but-incomplete tournament is the
    # most recent. Play starts Thursday and ends Sunday night, so it's over
    # once we're past start + 3 days 23:59.
    for tournament in response.data:
        date_str = tournament.get("tournament_date")
        if not date_str:
            continue
        start = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        end = start + timedelta(days=3, hours=23, minutes=59)
        if now > end:
            return tournament

    return None


def tournament_season_year(tournament):
    """The Slash Golf season year for a tournament, taken from its date."""
    date_str = tournament.get("tournament_date")
    if date_str:
        try:
            return str(datetime.fromisoformat(date_str.replace("Z", "+00:00")).year)
        except ValueError:
            pass
    return str(datetime.now(timezone.utc).year)


def resolve_tourn_id(tournament, year):
    """Find the Slash Golf tournId for a DB tournament.

    Prefers the stored ``slashgolf_tourn_id`` (set by sync_schedule.py). Falls
    back to a one-time name match against that season's /schedule so scoring
    still works before a sync has run. Returns None if it can't be mapped.
    """
    stored = tournament.get("slashgolf_tourn_id")
    if stored:
        return str(stored)

    print("  No stored slashgolf_tourn_id — resolving via /schedule name match...")
    schedule = slashgolf.parse_schedule(slashgolf.fetch_schedule(year, ORG_ID))
    for ev in schedule:
        if ev["tourn_id"] and tournament_names_match(ev["name"], tournament["name"]):
            print(f"  Matched '{tournament['name']}' -> '{ev['name']}' (tournId={ev['tourn_id']})")
            return ev["tourn_id"]
    return None


# ---------------------------------------------------------------------------
# Picks + settings
# ---------------------------------------------------------------------------
def get_picks_for_tournament(supabase, tournament_id):
    """Get all picks for a tournament across all leagues, inserting 'No Pick'
    rows for members who didn't submit."""
    picks = supabase.table("picks").select("*").eq("tournament_id", tournament_id).execute().data or []
    existing = set((p["user_id"], p["league_id"]) for p in picks)

    all_members = supabase.table("league_members").select("user_id, league_id").execute().data or []
    missing = [
        {
            "user_id": m["user_id"],
            "league_id": m["league_id"],
            "tournament_id": tournament_id,
            "golfer_name": "No Pick",
            "winnings": 0,
        }
        for m in all_members
        if (m["user_id"], m["league_id"]) not in existing
    ]
    if missing:
        print(f"  Inserting {len(missing)} 'No Pick' row(s) for members who didn't submit")
        supabase.table("picks").insert(missing).execute()
        picks = supabase.table("picks").select("*").eq("tournament_id", tournament_id).execute().data or []

    # Attach display names.
    user_ids = list(set(p["user_id"] for p in picks if p.get("user_id")))
    users_map = {}
    if user_ids:
        rows = supabase.table("profiles").select("id, name").in_("id", user_ids).execute().data or []
        users_map = {u["id"]: u for u in rows}
    for pick in picks:
        pick["user_info"] = users_map.get(pick.get("user_id"), {})

    return picks


def get_all_league_settings(supabase):
    """Get settings for all leagues, keyed by league_id."""
    rows = supabase.table("league_settings").select("*").execute().data or []
    return {s["league_id"]: s for s in rows}


DEFAULT_LEAGUE_SETTINGS = {
    "no_pick_penalty": 10,
    "missed_cut_penalty": 10,
    "withdrawal_penalty": 10,
    "dq_penalty": 10,
}


def update_pick_winnings(supabase, pick_id, winnings, penalty_amount=0, penalty_reason=None):
    """Update winnings (and any penalty) for a specific pick."""
    update_data = {"winnings": winnings}
    if penalty_amount > 0:
        update_data["penalty_amount"] = penalty_amount
        update_data["penalty_reason"] = penalty_reason
    supabase.table("picks").update(update_data).eq("id", pick_id).execute()


def mark_tournament_completed(supabase, tournament_id):
    """Mark a tournament as completed."""
    supabase.table("tournaments").update({"completed": True}).eq("id", tournament_id).execute()


def set_tournament_winner(supabase, tournament_id, winner_name):
    """Record the winning golfer for a tournament (drives the trophy badge)."""
    supabase.table("tournaments").update({"winner_golfer_name": winner_name}).eq("id", tournament_id).execute()


# ---------------------------------------------------------------------------
# Matching + penalties
# ---------------------------------------------------------------------------
def index_players(players):
    """Build (by_player_id, by_normalized_name) lookups for a parsed field."""
    by_id = {p["player_id"]: p for p in players if p.get("player_id")}
    by_norm = {}
    for p in players:
        norm = normalize_name(p.get("player_name", ""))
        if norm:
            by_norm.setdefault(norm, p)
    return by_id, by_norm


def field_ids_by_norm(players):
    """Map normalized player name -> playerId for a parsed field, used to
    opportunistically backfill available_golfers.golfer_id."""
    out = {}
    for p in players:
        pid = p.get("player_id")
        if pid:
            out.setdefault(normalize_name(p.get("player_name", "")), pid)
    return out


def backfill_available_golfer_ids(supabase, players):
    """Set available_golfers.golfer_id from the scored field for rows that don't
    have one yet.

    This is the rate-limit-friendly way to populate golfer_id: it reuses the
    leaderboard already fetched for scoring (zero extra Slash Golf calls) and,
    over a season, fills in IDs for the league's golfers as they appear in
    fields. Only fills blanks -- never inserts or overwrites. Defensive: if the
    golfer_id column doesn't exist yet (migration not run), it logs and moves
    on rather than failing the scoring run.
    """
    try:
        by_norm = field_ids_by_norm(players)
        rows = supabase.table("available_golfers").select("*").execute().data or []
        filled = 0
        for g in rows:
            if g.get("golfer_id"):
                continue
            pid = by_norm.get(normalize_name(g.get("name", "")))
            if pid:
                supabase.table("available_golfers").update({"golfer_id": pid}).eq("id", g["id"]).execute()
                filled += 1
        if filled:
            print(f"Backfilled golfer_id on {filled} available golfer(s) from this field")
    except Exception as exc:
        print(f"  (golfer_id backfill skipped: {exc})")


def match_pick_to_player(pick, by_id, by_norm):
    """Resolve a pick to a leaderboard player.

    Exact ``golfer_id`` join first (the normal path for picks made through the
    app). Falls back to an exact normalized-name match for legacy picks with
    no golfer_id. No fuzzy matching: a miss is an honest miss.
    """
    gid = pick.get("golfer_id")
    if gid:
        player = by_id.get(str(gid))
        if player:
            return player
    norm = normalize_name(pick.get("golfer_name", ""))
    if norm:
        return by_norm.get(norm)
    return None


def calculate_penalty(status, position, league_settings):
    """Calculate penalty based on golfer status using league settings."""
    if status == "cut" or position == "CUT":
        return league_settings.get("missed_cut_penalty", 10), "missed_cut"
    if status == "withdrawn" or position == "WD":
        return league_settings.get("withdrawal_penalty", 10), "withdrawal"
    if status == "disqualified" or position == "DQ":
        return league_settings.get("dq_penalty", 10), "disqualification"
    return 0, None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def update_results(dry_run=True, mark_complete=False, force=False):
    """Main function to update tournament results across all leagues."""
    print("=" * 50)
    print("Golf League Results Updater (Slash Golf)")
    print("=" * 50)

    supabase = get_supabase_client()

    all_league_settings = get_all_league_settings(supabase)
    print(f"Loaded settings for {len(all_league_settings)} league(s)")

    # Decide which week to score from OUR schedule.
    tournament = get_tournament_to_update(supabase)
    if not tournament:
        print("\nNo ended, incomplete tournament to score right now. Nothing to do.")
        return

    year = tournament_season_year(tournament)
    print(f"\n[tournament] Target from schedule: '{tournament['name']}' (Week {tournament['week']}, season {year})")

    # Map our tournament onto a Slash Golf event.
    tourn_id = resolve_tourn_id(tournament, year)
    if not tourn_id:
        print("\n" + "!" * 60)
        print("COULD NOT MAP THIS TOURNAMENT TO A SLASH GOLF EVENT.")
        print(f"  Scheduled: '{tournament['name']}' (season {year})")
        print("Set tournaments.slashgolf_tourn_id (run sync_schedule.py), or enter")
        print("results manually via CommissionerTab.")
        print("!" * 60)
        return

    # Fetch + parse the leaderboard and earnings.
    print(f"[tournament] Slash Golf tournId={tourn_id}, orgId={ORG_ID}, year={year}")
    results = slashgolf.get_tournament_results(tourn_id, year, ORG_ID, tournament_name=tournament["name"])
    players = results["players"]
    print(f"[tournament] Parsed {len(players)} players; "
          f"status={results['event_status']!r} (completed={results['event_completed']})")
    if results["winner_name"]:
        print(f"[tournament] Winner: {results['winner_name']} (playerId={results['winner_player_id']})")

    # Safety gate: only score a finished ('Official') event. Scoring a live or
    # upcoming event would zero out every pick.
    if not results["event_completed"] and not force:
        print("\n" + "!" * 60)
        print(f"SLASH GOLF EVENT NOT FINAL (status='{results['event_status']}').")
        print("Refusing to apply updates or mark complete — results aren't final yet.")
        print("Re-run once the event is Official, or enter results manually. Use --force to override.")
        print("!" * 60)
        return

    # Safety gate: a completed tournament always pays prize money. An all-$0
    # field means the payload isn't carrying final results.
    total_field_winnings = sum((p.get("winnings") or 0) for p in players)
    if total_field_winnings <= 0 and not force:
        print("\n" + "!" * 60)
        print("LEADERBOARD HAS $0 EARNINGS ACROSS THE ENTIRE FIELD.")
        print("A finished tournament always has prize money, so this isn't final results.")
        print("Refusing to apply updates. Use --force to override.")
        print("!" * 60)
        return

    print(f"[tournament] Verified final results for Week {tournament['week']} (field purse ${total_field_winnings:,.0f}).")

    by_id, by_norm = index_players(players)

    picks = get_picks_for_tournament(supabase, tournament["id"])
    print(f"\nFound {len(picks)} picks across all leagues for this tournament")

    picks_by_league = {}
    for pick in picks:
        picks_by_league.setdefault(pick.get("league_id", "unknown"), []).append(pick)

    updates = []
    matched_count = 0
    unmatched_count = 0
    unmatched_names = []

    for league_id, league_picks in picks_by_league.items():
        league_settings = all_league_settings.get(league_id, DEFAULT_LEAGUE_SETTINGS)

        print(f"\n{'─' * 50}")
        print(f"League: {league_id}")
        print(f"  Settings: no_pick=${league_settings.get('no_pick_penalty', 500)}, "
              f"missed_cut=${league_settings.get('missed_cut_penalty', 10)}, "
              f"wd=${league_settings.get('withdrawal_penalty', 10)}, "
              f"dq=${league_settings.get('dq_penalty', 10)}")
        print(f"{'─' * 50}")

        for pick in league_picks:
            golfer_name = pick.get("golfer_name")
            user_name = pick.get("user_info", {}).get("name", "Unknown User")

            if not golfer_name or golfer_name == "No Pick":
                existing_penalty = pick.get("penalty_amount", 0) or 0
                existing_reason = pick.get("penalty_reason")
                if existing_penalty > 0 and existing_reason:
                    print(f"  {user_name}: No pick submitted (PRESERVING existing penalty: ${existing_penalty} - {existing_reason})")
                    updates.append({
                        "pick_id": pick["id"], "user": user_name, "league_id": league_id,
                        "golfer": None, "winnings": 0, "penalty": existing_penalty,
                        "penalty_reason": existing_reason, "preserved": True,
                    })
                else:
                    no_pick_penalty = league_settings.get("no_pick_penalty", 500)
                    print(f"  {user_name}: No pick submitted (penalty: ${no_pick_penalty})")
                    updates.append({
                        "pick_id": pick["id"], "user": user_name, "league_id": league_id,
                        "golfer": None, "winnings": 0, "penalty": no_pick_penalty,
                        "penalty_reason": "no_pick",
                    })
                continue

            result = match_pick_to_player(pick, by_id, by_norm)
            if result:
                matched_count += 1
                winnings = result.get("winnings", 0) or 0
                existing_penalty = pick.get("penalty_amount", 0) or 0
                existing_reason = pick.get("penalty_reason")

                if existing_penalty > 0 and existing_reason:
                    penalty, penalty_reason = existing_penalty, existing_reason
                    print(f"  {user_name}: {golfer_name} -> {result['position']} ({result['score']}) = ${winnings:,.0f}")
                    print(f"    ^ PRESERVING existing penalty: ${penalty} ({penalty_reason})")
                else:
                    penalty, penalty_reason = calculate_penalty(result.get("status", ""), result.get("position", ""), league_settings)
                    print(f"  {user_name}: {golfer_name} -> {result['position']} ({result['score']}) = ${winnings:,.0f}")
                    if penalty > 0:
                        print(f"    ^ Penalty: ${penalty} ({penalty_reason})")

                updates.append({
                    "pick_id": pick["id"], "user": user_name, "league_id": league_id,
                    "golfer": golfer_name, "position": result["position"], "score": result["score"],
                    "winnings": winnings, "penalty": penalty, "penalty_reason": penalty_reason,
                    "preserved": existing_penalty > 0 and existing_reason is not None,
                })
            else:
                unmatched_count += 1
                unmatched_names.append(golfer_name)
                print(f"  {user_name}: {golfer_name} -> NOT FOUND on leaderboard")
                updates.append({
                    "pick_id": pick["id"], "user": user_name, "league_id": league_id,
                    "golfer": golfer_name, "winnings": 0, "penalty": 0,
                    "penalty_reason": None, "error": "not_found",
                })

    # Summary
    print("\n" + "=" * 50)
    print("Summary:")
    print("=" * 50)
    for update in updates:
        status = f"${update['winnings']:,.0f}"
        if update.get("penalty", 0) > 0:
            status += f" (penalty: ${update['penalty']})"
            if update.get("preserved"):
                status += " [PRESERVED]"
        if update.get("error"):
            status += f" [ERROR: {update['error']}]"
        print(f"  {update['user']}: {update.get('golfer', 'No pick')} = {status}")

    total_real_picks = matched_count + unmatched_count
    print("\n" + "=" * 50)
    print(f"Matched {matched_count}/{total_real_picks} real picks")
    print("=" * 50)

    if unmatched_names:
        print(f"\nUnmatched picks ({len(unmatched_names)}):")
        for name in unmatched_names:
            print(f"  - '{name}' (normalized: '{normalize_name(name)}')")
        print("\nThese are individual misses (typically a legacy free-text pick with no")
        print("golfer_id whose name doesn't exactly match the field). Fix the pick's")
        print("golfer, or enter its result manually via CommissionerTab.")

    # Minimal, non-tunable sanity guard: a total wipeout means the wrong event
    # or a bad mapping, not individual misses. (Exact-join scoring makes the
    # old fractional "catastrophic match rate" gate unnecessary.)
    if total_real_picks > 0 and matched_count == 0 and not force:
        print("\n" + "!" * 60)
        print("ZERO real picks matched the leaderboard — wrong event or mapping.")
        print("Refusing to apply updates. Inspect the diagnostics above, then re-run")
        print("with --force to override.")
        print("!" * 60)
        return

    if dry_run:
        print("\n[DRY RUN] No changes made to database.")
        print("Run with --apply to update the database.")
        print("Run with --apply --complete to also mark tournament as completed.")
        return

    print("\nApplying updates to database...")
    for update in updates:
        if not update.get("error"):
            update_pick_winnings(
                supabase, update["pick_id"], update["winnings"],
                update.get("penalty", 0), update.get("penalty_reason"),
            )
    print("Results updated!")

    # Record the tournament winner (drives the trophy badge; previously this
    # was only ever entered by hand).
    if results["winner_name"]:
        print(f"Recording tournament winner: {results['winner_name']}")
        set_tournament_winner(supabase, tournament["id"], results["winner_name"])

    # Opportunistically fill in golfer_id on the league's golfers from this
    # week's field (free -- reuses the leaderboard we already fetched).
    backfill_available_golfer_ids(supabase, players)

    # Send push notifications.
    try:
        from send_notification import send_to_all
        send_to_all(
            title=f"Results: {tournament['name']}",
            body=f"Week {tournament['week']} results have been posted!",
            url="/",
            tag=f"results-week-{tournament['week']}",
        )
    except Exception as exc:
        print(f"  Push notifications skipped: {exc}")

    if mark_complete:
        print(f"Marking tournament '{tournament['name']}' as completed...")
        mark_tournament_completed(supabase, tournament["id"])
        print("Tournament marked as completed!")

    print("Done!")


if __name__ == "__main__":
    dry_run = "--apply" not in sys.argv
    mark_complete = "--complete" in sys.argv
    force = "--force" in sys.argv

    if dry_run:
        print("Running in DRY RUN mode (no database changes)")
        print("Use --apply to update the database")
        print("Use --apply --complete to also mark tournament as completed")
        print("Use --force to override the safety gates\n")

    update_results(dry_run=dry_run, mark_complete=mark_complete, force=force)
