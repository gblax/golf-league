#!/usr/bin/env python3
"""Unit tests for pick-reminder tournament selection.

Run with: cd scripts && python -m unittest test_send_reminders -v
"""

import unittest
from datetime import datetime, timedelta, timezone

from send_reminders import select_reminder_tournament


def _t(week, lock_time, completed=False, name=None):
    """Build a fake tournament row. lock_time may be a datetime or None."""
    raw = lock_time.isoformat() if isinstance(lock_time, datetime) else lock_time
    return {
        "week": week,
        "name": name or f"Week {week} Event",
        "picks_lock_time": raw,
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

    def test_fallback_to_incomplete_when_no_lock_time(self):
        """Misconfigured rows with no lock time still get a best-effort pick."""
        tournaments = [
            _t(20, None, completed=True),
            _t(21, None, completed=False, name="Earliest Incomplete"),
            _t(22, None, completed=False, name="Later Incomplete"),
        ]
        result = select_reminder_tournament(tournaments, now=NOW)
        self.assertEqual(result["name"], "Earliest Incomplete")

    def test_empty_returns_none(self):
        self.assertIsNone(select_reminder_tournament([], now=NOW))


if __name__ == "__main__":
    unittest.main()
