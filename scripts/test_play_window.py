#!/usr/bin/env python3
"""Unit tests for the off-season guards on the live-board and field jobs.

Once next season's schedule is loaded, "the earliest unscored tournament" is
next year's opener for months. These guards make sure the scheduled runs
recognise that and return before spending a Slash Golf call.

Run with: cd scripts && python -m unittest test_play_window -v
"""

import unittest
from datetime import datetime, timedelta, timezone

from golf_common import days_from_start
from sync_field import FIELD_WINDOW_DAYS
from update_leaderboard import in_play_window

# A Thursday first round, and "now" at various points around it.
START = datetime(2027, 1, 14, 0, 0, tzinfo=timezone.utc)
TOURNAMENT = {"name": "Sony Open", "tournament_date": "2027-01-14"}


class DaysFromStartTests(unittest.TestCase):
    def test_before_and_after(self):
        self.assertAlmostEqual(days_from_start(TOURNAMENT, START - timedelta(days=2)), -2.0)
        self.assertAlmostEqual(days_from_start(TOURNAMENT, START + timedelta(hours=36)), 1.5)

    def test_unknown_date(self):
        self.assertIsNone(days_from_start({"name": "?"}, START))
        self.assertIsNone(days_from_start({"tournament_date": "garbage"}, START))


class LeaderboardWindowTests(unittest.TestCase):
    def test_round_evenings_are_in_window(self):
        """The crons fire Fri/Sat/Sun/Mon 00:00 & 02:00 UTC = Thu–Sun evenings ET."""
        for offset in (timedelta(days=1), timedelta(days=2, hours=2), timedelta(days=4, hours=2)):
            self.assertTrue(in_play_window(TOURNAMENT, START + offset))

    def test_day_before_tee_off_is_in_window(self):
        self.assertTrue(in_play_window(TOURNAMENT, START - timedelta(hours=20)))

    def test_off_season_opener_is_skipped(self):
        """November run, January opener already loaded: no API call."""
        self.assertFalse(in_play_window(TOURNAMENT, START - timedelta(days=60)))

    def test_stale_unscored_tournament_is_skipped(self):
        """A week left incomplete months ago isn't re-fetched forever."""
        self.assertFalse(in_play_window(TOURNAMENT, START + timedelta(days=40)))

    def test_unknown_date_is_not_silently_skipped(self):
        self.assertTrue(in_play_window({"name": "no date"}, START))


class FieldWindowTests(unittest.TestCase):
    def test_tuesday_wednesday_before_are_in_window(self):
        """sync-field crons run Tue/Wed (14:00 & 22:00 UTC) before a Thursday start."""
        for offset in (timedelta(days=2), timedelta(days=1, hours=2)):
            self.assertTrue(in_play_window(TOURNAMENT, START - offset, window=FIELD_WINDOW_DAYS))

    def test_off_season_is_skipped(self):
        self.assertFalse(in_play_window(TOURNAMENT, START - timedelta(days=30), window=FIELD_WINDOW_DAYS))
        self.assertFalse(in_play_window(TOURNAMENT, START + timedelta(days=30), window=FIELD_WINDOW_DAYS))


if __name__ == "__main__":
    unittest.main()
