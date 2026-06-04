#!/usr/bin/env python3
"""
Unit tests for name normalization and tournament-name matching.

These helpers survived the move off ESPN: normalize_name still backs the
legacy-pick name fallback in scoring, and tournament_names_match maps a DB
tournament onto its Slash Golf /schedule row during sync. (The old fuzzy
golfer matcher and ESPN payload parser were deleted along with the scrape.)

Run with: cd scripts && python -m unittest test_name_matching -v
"""

import unittest

from slashgolf import normalize_name, tournament_names_match


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


class TournamentNamesMatchTests(unittest.TestCase):
    def test_exact(self):
        self.assertTrue(tournament_names_match("CJ Cup Byron Nelson", "CJ Cup Byron Nelson"))

    def test_sponsor_prefix_substring(self):
        self.assertTrue(tournament_names_match("THE CJ CUP Byron Nelson", "CJ Cup Byron Nelson"))

    def test_distinctive_token(self):
        self.assertTrue(tournament_names_match("AT&T Byron Nelson", "CJ Cup Byron Nelson"))

    def test_generic_token_alone_does_not_match(self):
        """Regression guard: a shared generic word must not be enough, or
        Myrtle Beach Classic scores against Rocket Classic."""
        self.assertFalse(tournament_names_match("Myrtle Beach Classic", "Rocket Classic"))
        self.assertFalse(tournament_names_match("Genesis Open", "US Open"))

    def test_unrelated(self):
        self.assertFalse(tournament_names_match("Masters Tournament", "Charles Schwab Challenge"))

    def test_empty(self):
        self.assertFalse(tournament_names_match("", "Rocket Classic"))
        self.assertFalse(tournament_names_match("Rocket Classic", ""))


if __name__ == "__main__":
    unittest.main()
