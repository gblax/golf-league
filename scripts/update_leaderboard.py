#!/usr/bin/env python3
"""
Golf League Live Leaderboard Updater

Fetches the in-progress (or just-finished) tournament's leaderboard from Slash
Golf and stores ONE snapshot per tournament in Supabase, so the web app can
show live positions/scores without ever exposing the RapidAPI key to the
browser.

Prize money is deliberately NOT fetched here — it only finalizes after the
event (that is the Monday job, update_results.py). A live refresh is therefore
a single API call, cheap enough to run a handful of times each tournament day.

Which event to snapshot is driven by OUR schedule: the earliest tournament that
isn't completed yet. If it hasn't teed off, the leaderboard comes back empty and
nothing is written (so an off-week or a Wednesday run is a harmless no-op).

Usage:
    python update_leaderboard.py            # dry run, prints a preview
    python update_leaderboard.py --apply    # store the snapshot
"""

import sys
from datetime import datetime, timezone

import slashgolf
from golf_common import get_supabase_client
# Reuse the schedule->Slash Golf event mapping the scorer already implements.
from update_results import resolve_tourn_id, tournament_season_year

ORG_ID = slashgolf.DEFAULT_ORG_ID


def get_current_tournament(supabase):
    """The tournament the league is currently on: earliest by week that isn't
    completed. Returns None when everything is already scored."""
    resp = (
        supabase.table("tournaments")
        .select("*")
        .eq("completed", False)
        .order("week")
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def store_snapshot(supabase, tournament_id, parsed):
    """Upsert the single live snapshot row for a tournament."""
    row = {
        "tournament_id": tournament_id,
        "players": parsed["players"],
        "cut_line": parsed["cut_line"],
        "event_status": parsed["event_status"],
        "round_status": parsed["round_status"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("live_leaderboard").upsert(row, on_conflict="tournament_id").execute()


def update_leaderboard(dry_run=True):
    print("=" * 50)
    print("Golf League Live Leaderboard Updater (Slash Golf)")
    print("=" * 50)

    supabase = get_supabase_client()
    tournament = get_current_tournament(supabase)
    if not tournament:
        print("No active tournament (everything is scored). Nothing to do.")
        return

    year = tournament_season_year(tournament)
    print(f"Active tournament: '{tournament['name']}' (Week {tournament['week']}, season {year})")

    tourn_id = resolve_tourn_id(tournament, year)
    if not tourn_id:
        print("Could not map this tournament to a Slash Golf event; skipping.")
        return

    parsed = slashgolf.get_live_leaderboard(
        tourn_id, year, ORG_ID, tournament_name=tournament["name"]
    )
    n = len(parsed["players"])
    print(
        f"Fetched leaderboard: {n} players, status={parsed['event_status']!r}, "
        f"round_status={parsed['round_status']!r}, cut_line={parsed['cut_line']!r}"
    )

    if n == 0:
        print("Leaderboard is empty (event hasn't started). Nothing to store.")
        return

    if dry_run:
        for p in parsed["players"][:8]:
            thru = f" thru {p['thru']}" if p.get("thru") else ""
            print(f"  {p['position']:>4}  {p['player_name']:<24} {p['score']:>4}  {p['status']}{thru}")
        print("\n[DRY RUN] No changes made. Run with --apply to store the snapshot.")
        return

    store_snapshot(supabase, tournament["id"], parsed)
    print("Snapshot stored.")
    print("Done!")


if __name__ == "__main__":
    dry_run = "--apply" not in sys.argv
    if dry_run:
        print("Running in DRY RUN mode (no DB writes). Use --apply to store.\n")
    update_leaderboard(dry_run=dry_run)
