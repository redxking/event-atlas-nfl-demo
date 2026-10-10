import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_cardinals_lions_broadcast.py"
spec = importlib.util.spec_from_file_location("cardinals_lions_broadcast", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CardinalsLionsTests(unittest.TestCase):
    def test_exact_game_article_claims_are_bounded_and_hashed(self):
        body = " ".join([
            "The Arizona Cardinals take on the Detroit Lions at State Farm Stadium on Sunday, October 11 at 1:25 p.m. MST.",
            "WATCH ON TV FOX Kevin Kugler (play-by-play), Daryl Johnston (analyst) and Allison Williams (sideline)",
            "LISTEN LIVE ON CARDINALS RADIO Arizona Sports 98.7 FM * J.P. Shadrick (play-by-play), A.Q. Shipley (analyst) and Dani Sureck (sideline)",
        ])
        result = module.extract(body, "2026-10-07T15:00:05Z", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual([item["id"] for item in result["claims"]], ["event_listing", "tv_assignment", "radio_assignment"])
        self.assertTrue(all(len(item["sourceTextSha256"]) == 64 for item in result["claims"]))

    def test_missing_role_passage_is_partial(self):
        result = module.extract("The Arizona Cardinals take on the Detroit Lions at State Farm Stadium on Sunday, October 11 at 1:25 p.m. MST.", "2026-10-07T15:00:05Z", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["missingClaimIds"], ["tv_assignment", "radio_assignment"])


if __name__ == "__main__":
    unittest.main()
