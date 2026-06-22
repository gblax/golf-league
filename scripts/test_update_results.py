#!/usr/bin/env python3
"""
Unit tests for the update_results run-outcome contract.

The Monday scorer must return True only when it had nothing to do (an off
week) or actually scored, and False when an ended tournament was due to be
scored but the run couldn't apply it — couldn't map, results not final, $0
field, or zero picks matched. The CLI turns False into a non-zero exit so a
scheduled GitHub Actions run goes RED (with a failure notification) instead of
a misleading green check.

update_results' heavy imports are lazy, and these tests patch out the DB and
Slash Golf calls, so this runs offline.

Run with: cd scripts && python -m unittest test_update_results -v
"""

import unittest
from unittest import mock

import update_results


def _tournament():
    return {"id": "t1", "name": "US Open", "week": 23, "tournament_date": "2026-06-18"}


def _final_results():
    return {
        "tournament_name": "US Open",
        "players": [
            {"player_id": "1", "player_name": "Winner Guy", "position": "1",
             "score": "-5", "winnings": 1_000_000.0, "status": "active"},
        ],
        "event_completed": True,
        "event_status": "Official",
        "winner_player_id": "1",
        "winner_name": "Winner Guy",
    }


class RunOutcomeTests(unittest.TestCase):
    def setUp(self):
        # A dummy client + empty league settings, so no DB or network is
        # touched. Each test overrides the schedule/mapping it needs.
        for target, value in (
            ("get_supabase_client", mock.MagicMock()),
            ("get_all_league_settings", {}),
        ):
            p = mock.patch.object(update_results, target, return_value=value)
            p.start()
            self.addCleanup(p.stop)

    def test_off_week_is_success(self):
        """No ended, incomplete tournament -> clean (green) outcome."""
        with mock.patch.object(update_results, "get_tournament_to_update", return_value=None):
            self.assertTrue(update_results.update_results(dry_run=True))

    def test_unmappable_tournament_fails(self):
        """An ended tournament that can't be mapped -> failure (red)."""
        with mock.patch.object(update_results, "get_tournament_to_update", return_value=_tournament()), \
             mock.patch.object(update_results, "resolve_tourn_id", return_value=None):
            self.assertFalse(update_results.update_results(dry_run=True))

    def test_not_final_fails(self):
        """Mapped, but results aren't Official yet -> failure (red)."""
        live = _final_results()
        live["event_completed"] = False
        live["event_status"] = "In Progress"
        with mock.patch.object(update_results, "get_tournament_to_update", return_value=_tournament()), \
             mock.patch.object(update_results, "resolve_tourn_id", return_value="026"), \
             mock.patch.object(update_results.slashgolf, "get_tournament_results", return_value=live):
            self.assertFalse(update_results.update_results(dry_run=True, force=False))

    def test_final_with_matches_is_success(self):
        """Final results with a matched pick -> success (green), even in a dry run."""
        picks = [{
            "id": "p1", "league_id": "L1", "golfer_id": "1", "golfer_name": "Winner Guy",
            "penalty_amount": 0, "penalty_reason": None, "user_info": {"name": "Greg"},
        }]
        with mock.patch.object(update_results, "get_tournament_to_update", return_value=_tournament()), \
             mock.patch.object(update_results, "resolve_tourn_id", return_value="026"), \
             mock.patch.object(update_results.slashgolf, "get_tournament_results", return_value=_final_results()), \
             mock.patch.object(update_results, "get_picks_for_tournament", return_value=picks):
            self.assertTrue(update_results.update_results(dry_run=True))


if __name__ == "__main__":
    unittest.main()
