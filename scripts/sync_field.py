#!/usr/bin/env python3
"""
Golf League Field Sync (Phase 2 pick backstop)

Pulls the current week's field/entry list from Slash Golf and stores it in
Supabase so the pick screen can tag golfers as in/out of the field and warn on
off-field picks.

The field is ADVISORY: it only firms up mid-week (Tue/Wed), so an empty result
is treated as "field not confirmed yet" and the run is a no-op. Beyond storing
the field, this run also attaches a Slash Golf golfer_id to any pick whose name
matches a field entry (so the Monday scorer gets an exact join) and opportunis-
tically backfills available_golfers.golfer_id — both free, since the field is
the same payload.

Which week is driven by OUR schedule: the earliest non-completed tournament.

Usage:
    python sync_field.py            # dry run, prints a preview
    python sync_field.py --apply    # store the field + attach ids
"""

import sys
from datetime import datetime, timezone

import slashgolf
from golf_common import get_supabase_client
from slashgolf import normalize_name
# Reuse the scorer's event mapping + id backfill, and the live updater's
# schedule-driven tournament selection.
from update_results import (
    resolve_tourn_id,
    tournament_season_year,
    backfill_available_golfer_ids,
)
from update_leaderboard import get_current_tournament

ORG_ID = slashgolf.DEFAULT_ORG_ID


def replace_field(supabase, tournament_id, players):
    """Replace the stored field for a tournament with the current entrants.
    A full replace (not upsert) so withdrawals drop out cleanly."""
    supabase.table("tournament_field").delete().eq("tournament_id", tournament_id).execute()
    rows = [
        {
            "tournament_id": tournament_id,
            "golfer_id": p.get("player_id") or None,
            "golfer_name": p.get("player_name"),
            "status": p.get("status"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        for p in players
        if p.get("player_name")
    ]
    if rows:
        supabase.table("tournament_field").insert(rows).execute()
    return len(rows)


def attach_golfer_ids_to_picks(supabase, tournament_id, players):
    """Attach a golfer_id to picks for this tournament that match a field entry
    by normalized name and don't already have one. Improves the Monday match."""
    by_norm = {}
    for p in players:
        pid = p.get("player_id")
        if pid:
            by_norm.setdefault(normalize_name(p.get("player_name", "")), pid)

    picks = (
        supabase.table("picks")
        .select("id, golfer_name, golfer_id")
        .eq("tournament_id", tournament_id)
        .execute()
        .data
        or []
    )
    filled = 0
    for pick in picks:
        if pick.get("golfer_id"):
            continue
        name = pick.get("golfer_name")
        if not name or name == "No Pick":
            continue
        pid = by_norm.get(normalize_name(name))
        if pid:
            supabase.table("picks").update({"golfer_id": pid}).eq("id", pick["id"]).execute()
            filled += 1
    return filled


def sync_field(dry_run=True):
    print("=" * 50)
    print("Golf League Field Sync (Slash Golf)")
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

    parsed = slashgolf.fetch_field(tourn_id, year, ORG_ID)
    players = parsed["players"]
    print(f"Field size from Slash Golf: {len(players)}")

    if not players:
        print("Field not confirmed yet (no entrants posted). Nothing to store.")
        return

    if dry_run:
        for p in players[:12]:
            print(f"  {p['player_name']:<26} (id={p['player_id']})")
        if len(players) > 12:
            print(f"  ... and {len(players) - 12} more")
        print("\n[DRY RUN] No changes made. Run with --apply to store the field.")
        return

    n = replace_field(supabase, tournament["id"], players)
    print(f"Stored {n} field entries.")

    filled = attach_golfer_ids_to_picks(supabase, tournament["id"], players)
    if filled:
        print(f"Attached golfer_id to {filled} pick(s) from the field.")

    backfill_available_golfer_ids(supabase, players)
    print("Done!")


if __name__ == "__main__":
    dry_run = "--apply" not in sys.argv
    if dry_run:
        print("Running in DRY RUN mode (no DB writes). Use --apply to store.\n")
    sync_field(dry_run=dry_run)
