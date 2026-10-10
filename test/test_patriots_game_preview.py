import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_patriots_game_preview.py"
spec = importlib.util.spec_from_file_location("patriots_preview", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PatriotsPreviewTests(unittest.TestCase):
    def test_extract_keeps_only_supported_claims(self):
        body = ' '.join([
            'The Patriots will wear red jerseys with white pants and a white helmet featuring the "Pat Patriot" logo with white facemasks.',
            'The 2001 team will be honored in a special pregame ceremony.',
            "Adam Vinatieri, who will receive his Pro Football Hall of Fame Ring of Excellence during halftime of this week's game against the Las Vegas Raiders.",
        ])
        result = module.extract(body, "2026-10-07T13:37:00Z", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["claims"]), 3)
        self.assertEqual(result["claims"][2]["names"], ["Adam Vinatieri"])
        self.assertTrue(all(len(item["sourceTextSha256"]) == 64 for item in result["claims"]))

    def test_missing_source_claim_is_partial(self):
        result = module.extract("The 2001 team will be honored in a special pregame ceremony.", "2026-10-07T13:37:00Z", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "partial")
        self.assertEqual(result["missingClaimIds"], ["throwback_uniforms", "vinatieri_halftime"])


if __name__ == "__main__":
    unittest.main()
