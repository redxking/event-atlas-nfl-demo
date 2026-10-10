"""WeGo stadium notice extraction must deduplicate route-page copies."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_wego_titans_alert import DETAIL, WINDOW, extract  # noqa: E402


def page(routes):
    blocks = []
    for index, route in enumerate(routes):
        body = DETAIL.replace("&", "&amp;")
        blocks.append(f'<div id="CT_Main_1_rptRoutes_ctl{index:02d}_divRoute" class="alerts-accordion" RouteNumber="{route}"><li class="alert-item"><b>{WINDOW}</b><br /><br />{body}</li></div>')
    return ("WeGo " + "".join(blocks)).encode()


class WeGoTitansAlertTests(unittest.TestCase):
    def test_four_route_copies_become_one_notice(self):
        result = extract(page(["14", "23", "41", "56"]), datetime(2026, 10, 10, tzinfo=timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["routeNumbers"], ["14", "23", "41", "56"])

    def test_missing_stadium_route_fails_closed(self):
        with self.assertRaises(ValueError):
            extract(page(["14", "23", "41"]), datetime(2026, 10, 10, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
