import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_titans_gameday.py"
spec = importlib.util.spec_from_file_location("titans_guide", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TitansGuideTests(unittest.TestCase):
    def test_extract_exact_plans_and_partial(self):
        body = "Parking Lots Open: 8 AM Gate 1 Ticket Office Opens: 9 AM Pinnacle Titan Up Tailgate: 10 AM Stadium Gates Open: 10 AM Alcohol Sales End: End of 3rd Quarter Parking Lots Close: 2 Hours After Game"
        result = module.extract(body, datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["claims"]), 6)
        self.assertEqual(result["gameId"], "nfl:401872984")
        partial = module.extract("Parking Lots Open: 8 AM", datetime.now(timezone.utc))
        self.assertEqual(partial["status"], "partial")
        self.assertIn("gates_open", partial["missingClaimIds"])

    def test_page_rejects_wrong_game_or_venue(self):
        wrapper = lambda text: ("<html><body>" + text + " " + "padding " * 300 + "</body></html>").encode()
        with self.assertRaises(ValueError):
            module.parse_page(wrapper("WEEK 5 • SUN 10/11 • 12:00 PM CDT Week 5 vs. TEXANS | Oct. 11, 2026 Wrong Stadium"))
        with self.assertRaises(ValueError):
            module.parse_page(wrapper("WEEK 5 • SUN 10/11 • 12:00 PM CDT Week 5 vs. COLTS | Oct. 11, 2026 Nissan Stadium"))


if __name__ == "__main__":
    unittest.main()
