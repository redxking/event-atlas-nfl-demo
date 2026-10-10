import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/sync_chiefs_game_center.py"
SPEC = importlib.util.spec_from_file_location("sync_chiefs_game_center", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ChiefsGameCenterTests(unittest.TestCase):
    def test_exact_game_and_bounded_plans(self):
        body = " ".join([
            "Chiefs Game Center WEEK 6 • SUN • 10/18 Los Angeles Chargers Kansas City Chiefs Arrowhead Stadium",
            "Game Planning Times PARKING LOTS Gates will open 4.5 hours prior to scheduled kick-off LEARN MORE",
            "OPEN PARK First 30 minutes after parking gates open LEARN MORE",
            "TAILGATE SUITES Open with parking gates; Close at kick-off LEARN MORE",
            "FORD TAILGATE DISTRICT Opens 30 minutes after parking gates, Closes at kick-off LEARN MORE",
            "COMMUNITYAMERICA CLUB LEVEL Opens 2.5 hours prior to kick-off LEARN MORE",
            "STADIUM GATES Open 2 hours prior to kick-off LEARN MORE",
        ])
        page = ("<html><body>" + body + " filler" * 100 + "</body></html>").encode()
        parsed = MODULE.parse_page(page)
        snapshot = MODULE.extract(parsed, datetime.now(timezone.utc))
        self.assertEqual(snapshot["status"], "ok")
        self.assertEqual(len(snapshot["claims"]), 6)
        self.assertEqual(snapshot["claims"][0]["openingOffsetMinutes"], -270)
        self.assertEqual(snapshot["claims"][-1]["openingOffsetMinutes"], -120)

    def test_wrong_game_or_missing_plan_is_rejected_or_partial(self):
        body = "<html><body>WEEK 6 • SUN • 10/18 Los Angeles Chargers Kansas City Chiefs Arrowhead Stadium " + " filler" * 100 + "</body></html>"
        self.assertEqual(MODULE.extract(MODULE.parse_page(body.encode()), datetime.now(timezone.utc))["status"], "failed")
        self.assertRaises(ValueError, MODULE.parse_page, body.replace("10/18", "10/25").encode())


if __name__ == "__main__":
    unittest.main()
