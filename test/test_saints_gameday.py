"""Fail-closed checks for the bounded Saints game-guide parser."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_saints_gameday import extract, parse_page  # noqa: E402


class SaintsGuideTests(unittest.TestCase):
    def test_exact_game_and_all_claims(self):
        source = "Saints vs. Vikings | 2026 NFL Week 5 | Gameday Guide Oct 09, 2026 at 10:01 AM The New Orleans Saints host the Minnesota Vikings at the Caesars Superdome. "
        source += "Champions Square will be open for pre-game festivities three hours prior to kick off for ticketed guests and conclude 45 minutes before kick off. "
        source += "Stage Performance: Big Sam's Funky Nation. National Anthem: Robin Barnes. "
        source += "Drew Brees Ring of Honor Presentation In our Meta Halftime ceremony, former Saints QB Drew Brees will be inducted during halftime. "
        source += "Legend of the Game: Joe Horn. "
        body = parse_page(("<html><body>" + source + " padding" * 100 + "</body></html>").encode())
        result = extract(body, datetime.now(timezone.utc))
        self.assertEqual(result["gameId"], "nfl:401872987")
        self.assertEqual(len(result["claims"]), 5)

    def test_identity_mismatch_fails_closed(self):
        bad = ("<html><body>Saints vs. Giants | 2026 NFL Week 5 | Gameday Guide " + "text " * 150 + "</body></html>").encode()
        with self.assertRaisesRegex(ValueError, "exact game"):
            parse_page(bad)
        failed = extract("", datetime.now(timezone.utc))
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(failed["claims"], [])


if __name__ == "__main__":
    unittest.main()
