import importlib.util
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_steelers_colts_broadcast.py"
spec = importlib.util.spec_from_file_location("steelers_colts_broadcast", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SteelersColtsTests(unittest.TestCase):
    def test_exact_game_article_claims_are_bounded_and_hashed(self):
        body = " ".join([
            "The Steelers take on the Colts from Acrisure Stadium in Pittsburgh, Pennsylvania.",
            "The game broadcast is carried on CBS (KDKA-TV locally in Pittsburgh). Game coverage begins Sunday at 1:00 p.m. ET. Jim Nantz (play-by-play), J.J. Watt (analyst), and Tracy Wolfson (field reporter) are on the game call.",
            "The BetMGM Steelers Kickoff pregame show with Bob Pompeani and former Steelers quarterback Charlie Batch airs at 11:30 a.m. ET on KDKA-TV.",
            "Steelers Audio Network - Game coverage begins at 1:00 p.m. ET; Pregame programming begins at 11:00 a.m.; Postgame coverage starts immediately following the game. Rob King (play-by-play), Max Starks (color analyst) & Missi Matthews (sideline reporter) are on the game call.",
        ])
        result = module.extract(body, "2026-10-06T18:00:00Z", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual([item["id"] for item in result["claims"]], ["event_listing", "tv_assignment", "pregame_assignment", "radio_assignment"])
        self.assertTrue(all(len(item["sourceTextSha256"]) == 64 for item in result["claims"]))
        self.assertNotIn("articleBody", json.dumps(result))

    def test_missing_assignment_is_partial(self):
        result = module.extract("The Steelers take on the Colts from Acrisure Stadium in Pittsburgh, Pennsylvania.", "2026-10-06T18:00:00Z", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["missingClaimIds"], ["tv_assignment", "pregame_assignment", "radio_assignment"])


if __name__ == "__main__":
    unittest.main()
