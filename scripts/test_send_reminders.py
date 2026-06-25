#!/usr/bin/env python3
"""Unit tests for pick-reminder tournament selection.

Run with: cd scripts && python -m unittest test_send_reminders -v
"""

import unittest
from datetime import datetime, timedelta, timezone

from send_reminders import select_reminder_tournament


def _iso(value):
    """Render a datetime as ISO; pass through strings/None untouched."""
    return value.isoformat() if isinstance(value, datetime) else value


def _t(week, lock_time, completed=False, name=None, tournament_date=None):
    """Build a fake tournament row.

    lock_time / tournament_date may each be a datetime, a raw string, or None.
    """
    return {
        "week": week,
        "name": name or f"Week {week} Event",
        "picks_lock_time": _iso(lock_time),
        "tournament_date": _iso(tournament_date),
        "completed": completed,
    }


# A fixed "now": Wednesday 9 PM ET == Thursday 01:00 UTC, when the cron runs.
NOW = datetime(2026, 5, 28, 1, 0, tzinfo=timezone.utc)


class SelectReminderTournamentTests(unittest.TestCase):
    def test_selects_imminent_future_lock(self):
        """The tournament locking ~6h from now is the target."""
        tournaments = [
            _t(20, NOW + timedelta(hours=6), name="This Week"),
            _t(21, NOW + timedelta(days=7), name="Next Week"),
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertEqual(result["name"], "This Week")

    def test_skips_past_locked_incomplete_week(self):
        """Regression: a past, already-locked week left incomplete (e.g. the
        Monday results run didn't mark it complete) must NOT be reminded.
        This is the 'notified after it locked' bug."""
        tournaments = [
            _t(19, NOW - timedelta(days=7), completed=False, name="Last Week (locked)"),
            _t(20, NOW + timedelta(hours=6), completed=False, name="This Week"),
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertEqual(result["name"], "This Week")

    def test_no_send_when_only_target_already_locked(self):
        """A late/missed cron run firing AFTER this week's lock must not jump
        ahead to next week — it should send nothing."""
        tournaments = [
            _t(20, NOW - timedelta(hours=1), name="This Week (just locked)"),
            _t(21, NOW + timedelta(days=7), name="Next Week"),
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertIsNone(result)

    def test_future_beyond_window_is_ignored(self):
        """A lock more than the lookahead window away is not imminent."""
        tournaments = [_t(21, NOW + timedelta(days=7), name="Next Week")]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertIsNone(result)

    def test_picks_soonest_among_multiple_open(self):
        tournaments = [
            _t(21, NOW + timedelta(hours=80), name="Later"),
            _t(20, NOW + timedelta(hours=6), name="Sooner"),
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertEqual(result["name"], "Sooner")

    def test_completed_future_row_ignored_via_past_lock(self):
        """A completed tournament has a past lock and is excluded naturally."""
        tournaments = [
            _t(19, NOW - timedelta(days=7), completed=True, name="Done"),
        ]
        self.assertIsNone(select_reminder_tournament(tournaments, now=NOW))

    def test_naive_lock_time_treated_as_utc(self):
        """ESPN/DB sometimes hands back a naive timestamp string."""
        tournaments = [
            {"week": 20, "name": "This Week",
             "picks_lock_time": "2026-05-28 05:00:00", "completed": False},
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertEqual(result["name"], "This Week")

    def test_tournament_date_used_as_deadline_when_no_lock(self):
        """With no picks_lock_time, first-round tee-off (tournament_date) is the
        deadline proxy — and an imminent, future one is a valid target."""
        tournaments = [
            _t(20, None, tournament_date=NOW + timedelta(hours=6), name="This Week"),
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertEqual(result["name"], "This Week")

    def test_no_lock_and_past_tournament_date_is_skipped(self):
        """Regression for the 'middle of the night, too late, already picked'
        bug: a past week with no lock time (e.g. never marked complete) used to
        fall through the timing checks and get reminded. It must not."""
        tournaments = [
            _t(19, None, tournament_date=NOW - timedelta(days=3),
               completed=False, name="Already Played"),
        ]
        self.assertIsNone(select_reminder_tournament(tournaments, now=NOW))

    def test_no_lock_and_no_date_is_skipped(self):
        """No deadline known at all → we cannot tell if a nudge is on time, so
        we send nothing rather than risk a late one."""
        tournaments = [_t(21, None, tournament_date=None, completed=False)]
        self.assertIsNone(select_reminder_tournament(tournaments, now=NOW))

    def test_explicit_lock_wins_over_tournament_date(self):
        """When both are present, the explicit lock time is authoritative."""
        tournaments = [
            _t(20, NOW + timedelta(hours=6),
               tournament_date=NOW + timedelta(hours=30), name="Locks Early"),
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertEqual(result["name"], "Locks Early")

    def test_empty_returns_none(self):
        self.assertIsNone(select_reminder_tournament([], now=NOW))


if __name__ == "__main__":
    unittest.main()
