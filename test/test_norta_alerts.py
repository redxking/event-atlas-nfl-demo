"""RTA public-page parser identity and recency checks."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_norta_alerts import parse_page  # noqa: E402


class RtaPageTests(unittest.TestCase):
    def test_current_panel_extracts_bounded_notice(self):
        page = '''<html><head><link rel="canonical" href="https://www.norta.com/ride-with-us/service-alerts" /></head><body>
        Bus Alerts Streetcar Alerts
        <div class="panel-heading" role="tab"><div class="alert-number route_46"><span>46</span></div>
        <div class="alert-text"><span>Loyola/Rampart Streetcar</span></div></div>
        <div class="panel-content new-panel-con"><h3>Service notice</h3><h3><i>AS OF</i>&nbsp;October 10 2026 08:00 AM</h3>
        <h4><p>Poydras Street service update.</p></h4></div></body></html>'''
        result = parse_page(page.encode(), datetime(2026, 10, 10, 12, tzinfo=timezone.utc))
        self.assertEqual(result["listedCount"], 1)
        self.assertEqual(result["recentCount"], 1)
        self.assertEqual(result["recent"][0]["routeId"], "46")
        self.assertEqual(result["recent"][0]["asOfDate"], "2026-10-10")

    def test_wrong_page_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "identity"):
            parse_page(b"<html><body>Bus Alerts Streetcar Alerts</body></html>", datetime.now(timezone.utc))
        empty = b'<html><head><link rel="canonical" href="https://www.norta.com/ride-with-us/service-alerts" /></head><body>Bus Alerts Streetcar Alerts</body></html>'
        with self.assertRaisesRegex(ValueError, "extraction empty"):
            parse_page(empty, datetime.now(timezone.utc))


if __name__ == "__main__":
    unittest.main()
