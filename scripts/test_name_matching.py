#!/usr/bin/env python3
"""
Unit tests for name normalization and golfer-name matching.

Run with: cd scripts && python -m unittest test_name_matching -v
"""

import unittest

from update_results import match_golfer_name, normalize_name


def _lb(*names):
    """Build a fake leaderboard result list from a sequence of player names."""
    return [
        {
            "player_name": n,
            "position": "1",
            "score": "-5",
            "winnings": 0,
            "status": "active",
        }
        for n in names
    ]


class NormalizeNameTests(unittest.TestCase):
    def test_accents_stripped(self):
        self.assertEqual(normalize_name("José Ramírez"), "jose ramirez")
        self.assertEqual(normalize_name("Nicolás Echavarría"), "nicolas echavarria")
        self.assertEqual(normalize_name("Ángel Cabrera"), "angel cabrera")

    def test_suffix_stripped(self):
        self.assertEqual(normalize_name("Davis Thompson III"), "davis thompson")
        self.assertEqual(normalize_name("Sammy Davis Jr."), "sammy davis")
        self.assertEqual(normalize_name("John Smith IV"), "john smith")

    def test_hyphen_split(self):
        self.assertEqual(normalize_name("Rafael Cabrera-Bello"), "rafael cabrera bello")
        self.assertEqual(normalize_name("Byeong-Hun An"), "byeong hun an")

    def test_initials_expanded(self):
        self.assertEqual(normalize_name("J.J. Spaun"), "j j spaun")
        self.assertEqual(normalize_name("K.H. Lee"), "k h lee")

    def test_apostrophe(self):
        self.assertEqual(normalize_name("Séamus O'Hara"), "seamus o hara")

    def test_empty_and_none(self):
        self.assertEqual(normalize_name(""), "")
        self.assertEqual(normalize_name(None), "")

    def test_whitespace_collapse(self):
        self.assertEqual(normalize_name("  Rory   McIlroy  "), "rory mcilroy")


class MatchGolferNameTests(unittest.TestCase):
    def test_accent_match(self):
        lb = _lb("Jose Ramirez")
        self.assertIsNotNone(match_golfer_name("José Ramírez", lb))

    def test_accent_match_reverse(self):
        lb = _lb("José Ramírez")
        self.assertIsNotNone(match_golfer_name("Jose Ramirez", lb))

    def test_suffix_match(self):
        lb = _lb("Davis Thompson")
        self.assertIsNotNone(match_golfer_name("Davis Thompson III", lb))

    def test_suffix_on_leaderboard(self):
        lb = _lb("Davis Thompson III")
        self.assertIsNotNone(match_golfer_name("Davis Thompson", lb))

    def test_hyphen_match(self):
        lb = _lb("Rafael Cabrera Bello")
        self.assertIsNotNone(match_golfer_name("Rafael Cabrera-Bello", lb))

    def test_hyphen_reverse(self):
        lb = _lb("Rafael Cabrera-Bello")
        self.assertIsNotNone(match_golfer_name("Rafael Cabrera Bello", lb))

    def test_initial_match(self):
        lb = _lb("JJ Spaun")
        self.assertIsNotNone(match_golfer_name("J.J. Spaun", lb))

    def test_initial_match_reverse(self):
        lb = _lb("J.J. Spaun")
        self.assertIsNotNone(match_golfer_name("JJ Spaun", lb))

    def test_hyphenated_given_name(self):
        lb = _lb("Byeong Hun An")
        self.assertIsNotNone(match_golfer_name("Byeong-Hun An", lb))

    def test_middle_initial(self):
        lb = _lb("Viktor J Hovland")
        self.assertIsNotNone(match_golfer_name("Viktor Hovland", lb))

    def test_middle_initial_reverse(self):
        lb = _lb("Viktor Hovland")
        self.assertIsNotNone(match_golfer_name("Viktor J. Hovland", lb))

    def test_common_surname_no_false_positive(self):
        """
        Regression guard: the old last-name-only fallback would incorrectly
        match 'Chan Kim' to 'Si Woo Kim' if it were the only 'Kim' on the
        board. The new matcher must refuse.
        """
        lb = _lb("Si Woo Kim", "Tom Kim", "Sungjae Im")
        self.assertIsNone(match_golfer_name("Chan Kim", lb))

    def test_not_found_returns_none(self):
        lb = _lb("Scottie Scheffler", "Jordan Spieth")
        self.assertIsNone(match_golfer_name("Rory McIlroy", lb))

    def test_empty_pick_name(self):
        lb = _lb("Scottie Scheffler")
        self.assertIsNone(match_golfer_name("", lb))

    def test_returns_leaderboard_row(self):
        lb = _lb("Jose Ramirez")
        match = match_golfer_name("José Ramírez", lb)
        self.assertIsNotNone(match)
        self.assertEqual(match["player_name"], "Jose Ramirez")

    def test_disambiguates_among_common_first_names(self):
        lb = _lb("Tom Kim", "Tom Hoge")
        match = match_golfer_name("Tom Kim", lb)
        self.assertIsNotNone(match)
        self.assertEqual(match["player_name"], "Tom Kim")


if __name__ == "__main__":
    unittest.main()
