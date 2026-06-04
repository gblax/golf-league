#!/usr/bin/env python3
"""
Unit tests for the Slash Golf parsers (no network, no DB).

Run with: cd scripts && python -m unittest test_slashgolf -v
"""

import unittest

import slashgolf as sg


# Representative payloads, trimmed to the fields the parsers read. Numbers and
# dates use Mongo extended JSON, exactly as Slash Golf returns them.
LEADERBOARD = {
    "status": "Official",
    "roundStatus": "Official",
    "cutLines": [{"cutCount": {"$numberInt": "57"}, "cutScore": "-2"}],
    "leaderboardRows": [
        {"firstName": "Russell", "lastName": "Henley", "playerId": "34098",
         "position": "1", "total": "-12", "status": "complete"},
        {"firstName": "Eric", "lastName": "Cole", "playerId": "47591",
         "position": "2", "total": "-12", "status": "complete"},
        {"firstName": "Ben", "lastName": "Griffin", "playerId": "54591",
         "position": "T3", "total": "-10", "status": "complete"},
        {"firstName": "Matthieu", "lastName": "Pavon", "playerId": "99001",
         "position": "CUT", "total": "-1", "status": "cut"},
        {"firstName": "Stephan", "lastName": "Jaeger", "playerId": "99002",
         "position": "WD", "total": "E", "status": "wd"},
    ],
}

EARNINGS = {
    "leaderboard": [
        {"playerId": "34098", "earnings": {"$numberInt": "1782000"}},
        {"playerId": "47591", "earnings": {"$numberInt": "1079100"}},
        {"playerId": "54591", "earnings": {"$numberInt": "524700"}},
        {"playerId": "99001", "earnings": {"$numberInt": "0"}},
    ],
}

SCHEDULE = {
    "schedule": [
        {"tournId": "006", "name": "Sony Open in Hawaii",
         "date": {"start": {"$date": {"$numberLong": "1768435200000"}},
                  "end": {"$date": {"$numberLong": "1768694400000"}},
                  "weekNumber": "3"},
         "purse": {"$numberInt": "9100000"},
         "winnersShare": {"$numberInt": "1638000"},
         "format": "stroke"},
    ],
}


class UnwrapTests(unittest.TestCase):
    def test_unwrap_scalars(self):
        self.assertEqual(sg.unwrap({"$numberInt": "5"}), "5")
        self.assertEqual(sg.unwrap({"$numberLong": "123"}), "123")
        self.assertEqual(sg.unwrap({"$date": {"$numberLong": "123"}}), "123")
        self.assertEqual(sg.unwrap(7), 7)
        self.assertEqual(sg.unwrap("x"), "x")

    def test_to_float(self):
        self.assertEqual(sg.to_float({"$numberInt": "1782000"}), 1782000.0)
        self.assertEqual(sg.to_float("$1,782,000"), 1782000.0)
        self.assertEqual(sg.to_float(None), 0.0)
        self.assertEqual(sg.to_float("nope"), 0.0)

    def test_to_int_and_epoch(self):
        self.assertEqual(sg.to_int({"$numberInt": "57"}), 57)
        self.assertIsNone(sg.to_int(None))
        self.assertEqual(sg.to_epoch_ms({"$date": {"$numberLong": "1768435200000"}}), 1768435200000)


class IsOfficialTests(unittest.TestCase):
    def test_official(self):
        self.assertTrue(sg.is_event_official({"status": "Official"}))
        self.assertTrue(sg.is_event_official({"status": "x", "roundStatus": "Official"}))

    def test_not_official(self):
        self.assertFalse(sg.is_event_official({"status": "In Progress"}))
        self.assertFalse(sg.is_event_official({}))


class ParseLeaderboardTests(unittest.TestCase):
    def setUp(self):
        self.res = sg.parse_leaderboard(LEADERBOARD, EARNINGS, tournament_name="Charles Schwab Challenge")
        self.by_name = {p["player_name"]: p for p in self.res["players"]}

    def test_metadata(self):
        self.assertEqual(self.res["tournament_name"], "Charles Schwab Challenge")
        self.assertTrue(self.res["event_completed"])
        self.assertEqual(self.res["event_status"], "Official")
        self.assertEqual(len(self.res["players"]), 5)

    def test_winner_is_position_one(self):
        self.assertEqual(self.res["winner_name"], "Russell Henley")
        self.assertEqual(self.res["winner_player_id"], "34098")

    def test_money_joined_by_player_id(self):
        self.assertEqual(self.by_name["Russell Henley"]["winnings"], 1782000.0)
        self.assertEqual(self.by_name["Ben Griffin"]["winnings"], 524700.0)

    def test_tie_position_not_winner(self):
        griffin = self.by_name["Ben Griffin"]
        self.assertEqual(griffin["position"], "T3")
        self.assertNotEqual(self.res["winner_name"], "Ben Griffin")

    def test_cut_player_zeroed(self):
        pavon = self.by_name["Matthieu Pavon"]
        self.assertEqual(pavon["status"], "cut")
        self.assertEqual(pavon["winnings"], 0.0)

    def test_withdrawn_player(self):
        jaeger = self.by_name["Stephan Jaeger"]
        self.assertEqual(jaeger["status"], "withdrawn")
        self.assertEqual(jaeger["winnings"], 0.0)

    def test_player_id_propagated(self):
        self.assertEqual(self.by_name["Russell Henley"]["player_id"], "34098")

    def test_no_earnings_payload_means_zero(self):
        res = sg.parse_leaderboard(LEADERBOARD, None)
        self.assertTrue(all(p["winnings"] == 0.0 for p in res["players"]))
        # ...but statuses and winner are still resolved from the leaderboard.
        self.assertEqual(res["winner_name"], "Russell Henley")

    def test_unresolved_tie_has_no_winner(self):
        """A board whose leader still shows 'T1' (e.g. not yet final) has no
        outright winner."""
        lb = {"status": "In Progress", "leaderboardRows": [
            {"firstName": "A", "lastName": "B", "playerId": "1", "position": "T1", "status": "active"},
            {"firstName": "C", "lastName": "D", "playerId": "2", "position": "T1", "status": "active"},
        ]}
        res = sg.parse_leaderboard(lb)
        self.assertIsNone(res["winner_name"])
        self.assertFalse(res["event_completed"])


class EarningsByPlayerTests(unittest.TestCase):
    def test_builds_map(self):
        m = sg.earnings_by_player(EARNINGS)
        self.assertEqual(m["34098"], 1782000.0)
        self.assertEqual(m["99001"], 0.0)

    def test_empty(self):
        self.assertEqual(sg.earnings_by_player(None), {})
        self.assertEqual(sg.earnings_by_player({}), {})


class ParseScheduleTests(unittest.TestCase):
    def test_parses_event(self):
        events = sg.parse_schedule(SCHEDULE)
        self.assertEqual(len(events), 1)
        ev = events[0]
        self.assertEqual(ev["tourn_id"], "006")
        self.assertEqual(ev["name"], "Sony Open in Hawaii")
        self.assertEqual(ev["week_number"], 3)
        self.assertEqual(ev["purse"], 9100000.0)
        self.assertEqual(ev["winners_share"], 1638000.0)
        self.assertEqual(ev["start_ms"], 1768435200000)
        self.assertIsNone(ev["course"])  # not present at schedule level


if __name__ == "__main__":
    unittest.main()
