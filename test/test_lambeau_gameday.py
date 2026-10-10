import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("sync_lambeau_gameday", Path(__file__).resolve().parents[1] / "scripts/sync_lambeau_gameday.py")
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)
NOW = datetime(2026, 10, 10, 6, 0, tzinfo=timezone.utc)
PAGE = b'''<html><body><h1>Lambeau Field</h1><h2>Gate Entry</h2><p>All stadium gates open two hours prior to kickoff.</p><h2>Traffic Flow</h2><p>Oneida St will be closed for vehicular traffic from Lombardi Ave to Mike McCarthy Way (formerly Potts Ave) from 4 hours prior to kick-off until 2 hours after the conclusion of the game. Lombardi Ave will be closed from Ridge Rd to Oneida St. at kick-off. Mike McCarthy Way (formerly Potts Ave) will become one way eastbound from Oneida St to Ashland Ave. Oneida St will become one way northbound. Ridge Rd will become one way northbound.</p><p>Fans will be offered four free, efficient and convenient gameday bus routes for all Packers home games. The routes begin four hours before kickoff and run for approximately one hour following a game, leaving Lambeau Field every 30 minutes. Your driver will meet you at the corner of Mike McCarthy Way and Holmgren Way.</p></body></html>'''


class LambeauPlanTests(unittest.TestCase):
    def test_bounded_claims_have_source_digests(self):
        result = MOD.parse_page(PAGE, NOW)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["claims"]), 6)
        self.assertTrue(all(len(item["sourceTextSha256"]) == 64 for item in result["claims"]))

    def test_changed_source_text_causes_partial_snapshot(self):
        result = MOD.parse_page(PAGE.replace(b"All stadium gates open two hours", b"All stadium gates open one hour"), NOW)
        self.assertEqual(result["status"], "partial")
        self.assertIn("gates", result["missingClaimIds"])


if __name__ == "__main__":
    unittest.main()
