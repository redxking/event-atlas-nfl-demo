import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_commanders_gameday.py"
spec = importlib.util.spec_from_file_location("commanders_guide", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CommandersGuideTests(unittest.TestCase):
    def test_extract_and_partial(self):
        body = "Gameday Entertainment Legends Plaza: Michelle Blackwell Band Color Guard: United States Navy Anthem: Generald Wilson Halftime: Crucial Catch Tribute Legend of the Game: Taylor Heinicke 8:00 AM: Rideshare lots open 9:00 AM: Parking lots opens 10:00 AM: Legends Plaza opens 11:00 AM: Stadium gates opens Fan Code of Conduct"
        result = module.extract(body, datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["claims"]), 9)
        self.assertEqual(module.extract("Gameday Entertainment 11:00 AM: Stadium gates opens Fan Code of Conduct", datetime.now(timezone.utc))["status"], "partial")

    def test_page_rejects_wrong_game(self):
        wrapper = lambda text: ("<html><body>" + text + " " + "padding " * 300 + "</body></html>").encode()
        with self.assertRaises(ValueError):
            module.parse_page(wrapper("Gameday Entertainment Week 5 vs. Eagles Sunday, October 11 1:00 PM HOME: Northwest Stadium"))
        with self.assertRaises(ValueError):
            module.parse_page(wrapper("Gameday Entertainment Week 5 vs. Giants Sunday, October 11 1:00 PM HOME: Wrong Stadium"))


if __name__ == "__main__":
    unittest.main()
