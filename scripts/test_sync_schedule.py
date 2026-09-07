#!/usr/bin/env python3
"""Unit tests for the schedule sync's week numbering and season helpers.

Run with: cd scripts && python -m unittest test_sync_schedule -v
"""

import unittest

from golf_common import season_of
from sync_schedule import assign_weeks, renumber_weeks


def _ev(name, day, tourn_id=None):
    """A parsed schedule event starting on `day` of Jan 2027 (epoch ms)."""
    # 2027-01-01T00:00:00Z == 1798761600000 ms
    return {"name": name, "tourn_id": tourn_id or name[:3], "start_ms": 1798761600000 + (day - 1) * 86400000}


def _row(name, week, date):
    return {"id": name, "name": name, "week": week, "tournament_date": date}


class AssignWeeksTests(unittest.TestCase):
    def test_empty_season_numbers_from_one_in_date_order(self):
        events = [_ev("Farmers", 28), _ev("Sony", 14), _ev("AmEx", 21)]
        numbered = assign_weeks([], events)
        self.assertEqual([(w, e["name"]) for w, e in numbered],
                         [(1, "Sony"), (2, "AmEx"), (3, "Farmers")])

    def test_continues_after_highest_existing_week(self):
        """Events added to a season that already has rows never collide."""
        numbered = assign_weeks([1, 2, 3], [_ev("Genesis", 18), _ev("Phoenix", 11)])
        self.assertEqual([w for w, _ in numbered], [4, 5])
        self.assertEqual(numbered[0][1]["name"], "Phoenix")

    def test_ignores_slashgolf_calendar_week(self):
        """The PGA calendar weekNumber must not leak into the league's scheme."""
        events = [dict(_ev("Sony", 14), week_number=3), dict(_ev("AmEx", 21), week_number=4)]
        self.assertEqual([w for w, _ in assign_weeks([], events)], [1, 2])

    def test_same_day_events_tie_break_on_name(self):
        numbered = assign_weeks([], [_ev("Zurich", 7), _ev("Alpha", 7)])
        self.assertEqual([e["name"] for _, e in numbered], ["Alpha", "Zurich"])


class RenumberWeeksTests(unittest.TestCase):
    def test_already_sequential_is_a_noop(self):
        rows = [_row("A", 1, "2027-01-14"), _row("B", 2, "2027-01-21"), _row("C", 3, "2027-01-28")]
        self.assertEqual(renumber_weeks(rows), [])

    def test_closes_gaps_after_pruning(self):
        """Deleting the opposite-field week 3 leaves 1,2,4,5 -> 1,2,3,4."""
        rows = [_row("A", 1, "2027-01-14"), _row("B", 2, "2027-01-21"),
                _row("D", 4, "2027-02-04"), _row("E", 5, "2027-02-11")]
        plan = renumber_weeks(rows)
        self.assertEqual([(t["name"], w) for t, w in plan], [("D", 3), ("E", 4)])

    def test_reorders_by_date_not_existing_week(self):
        rows = [_row("Late", 1, "2027-03-04"), _row("Early", 2, "2027-01-14")]
        plan = renumber_weeks(rows)
        self.assertEqual([(t["name"], w) for t, w in plan], [("Early", 1), ("Late", 2)])

    def test_empty(self):
        self.assertEqual(renumber_weeks([]), [])


class SeasonOfTests(unittest.TestCase):
    def test_prefers_explicit_column(self):
        self.assertEqual(season_of({"season": 2027, "tournament_date": "2026-12-30"}), 2027)

    def test_falls_back_to_date_year(self):
        self.assertEqual(season_of({"tournament_date": "2026-06-18"}), 2026)
        self.assertEqual(season_of({"season": None, "tournament_date": "2027-01-07"}), 2027)

    def test_unknown(self):
        self.assertIsNone(season_of({}))
        self.assertIsNone(season_of({"tournament_date": "not a date"}))


if __name__ == "__main__":
    unittest.main()
