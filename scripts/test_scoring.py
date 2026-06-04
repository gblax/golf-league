#!/usr/bin/env python3
"""
Unit tests for pick -> leaderboard matching and penalty calculation.

These exercise the exact-join scoring that replaced fuzzy name matching.
Importing update_results must NOT require the supabase package or DB creds
(its heavy imports are lazy), so this runs offline.

Run with: cd scripts && python -m unittest test_scoring -v
"""

import unittest

from update_results import calculate_penalty, field_ids_by_norm, index_players, match_pick_to_player


def _field():
    return [
        {"player_id": "34098", "player_name": "Russell Henley", "position": "1", "status": "active", "winnings": 1782000.0},
        {"player_id": "54591", "player_name": "Ben Griffin", "position": "T3", "status": "active", "winnings": 524700.0},
        {"player_id": "99001", "player_name": "Nicolás Echavarría", "position": "T6", "status": "active", "winnings": 100000.0},
    ]


class MatchPickTests(unittest.TestCase):
    def setUp(self):
        self.by_id, self.by_norm = index_players(_field())

    def test_match_by_golfer_id(self):
        pick = {"golfer_id": "34098", "golfer_name": "stale name"}
        self.assertEqual(match_pick_to_player(pick, self.by_id, self.by_norm)["player_name"], "Russell Henley")

    def test_match_by_name_when_no_id(self):
        pick = {"golfer_name": "Russell Henley"}
        self.assertEqual(match_pick_to_player(pick, self.by_id, self.by_norm)["player_id"], "34098")

    def test_name_fallback_normalizes_accents(self):
        pick = {"golfer_name": "Nicolas Echavarria"}
        self.assertEqual(match_pick_to_player(pick, self.by_id, self.by_norm)["player_id"], "99001")

    def test_id_miss_falls_back_to_name(self):
        pick = {"golfer_id": "00000", "golfer_name": "Ben Griffin"}
        self.assertEqual(match_pick_to_player(pick, self.by_id, self.by_norm)["player_id"], "54591")

    def test_unknown_golfer_returns_none(self):
        self.assertIsNone(match_pick_to_player({"golfer_name": "Tiger Woods"}, self.by_id, self.by_norm))

    def test_empty_pick_returns_none(self):
        self.assertIsNone(match_pick_to_player({"golfer_name": ""}, self.by_id, self.by_norm))
        self.assertIsNone(match_pick_to_player({}, self.by_id, self.by_norm))


class FieldIdsByNormTests(unittest.TestCase):
    def test_maps_normalized_name_to_id(self):
        m = field_ids_by_norm(_field())
        self.assertEqual(m["russell henley"], "34098")
        self.assertEqual(m["nicolas echavarria"], "99001")  # accents normalized

    def test_skips_players_without_id(self):
        m = field_ids_by_norm([{"player_name": "No Id", "player_id": ""}])
        self.assertEqual(m, {})


class CalculatePenaltyTests(unittest.TestCase):
    SETTINGS = {"missed_cut_penalty": 5, "withdrawal_penalty": 6, "dq_penalty": 7, "no_pick_penalty": 8}

    def test_cut(self):
        self.assertEqual(calculate_penalty("cut", "CUT", self.SETTINGS), (5, "missed_cut"))

    def test_withdrawn(self):
        self.assertEqual(calculate_penalty("withdrawn", "WD", self.SETTINGS), (6, "withdrawal"))

    def test_disqualified(self):
        self.assertEqual(calculate_penalty("disqualified", "DQ", self.SETTINGS), (7, "disqualification"))

    def test_active_no_penalty(self):
        self.assertEqual(calculate_penalty("active", "T5", self.SETTINGS), (0, None))

    def test_position_drives_penalty_when_status_blank(self):
        self.assertEqual(calculate_penalty("", "CUT", self.SETTINGS), (5, "missed_cut"))


if __name__ == "__main__":
    unittest.main()
