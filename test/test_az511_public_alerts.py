import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_az511_public_alerts import extract  # noqa: E402


class Az511PublicAlertsTest(unittest.TestCase):
    def test_dated_regional_notice_is_bounded(self):
        html = b'''<html><div id="AlertsPage"><table><tbody><tr><td>Weekend freeway closures/restrictions in Phoenix area</td><td><p>PHOENIX - restrictions Friday, Oct. 9-Monday, Oct. 12:</p><ul><li>EB L-101 (Agua Fria Freeway) closed between 75th and 51st avenues.</li></ul></td><td>Oct 8 2026, 1:45 PM</td></tr></tbody></table></div></html>'''
        output = extract(html, datetime(2026, 10, 10, tzinfo=timezone.utc))
        self.assertEqual(output["status"], "ok")
        self.assertEqual(output["entries"][0]["localDateStart"], "2026-10-09")
        self.assertEqual(output["entries"][0]["localDateEnd"], "2026-10-12")
        self.assertEqual(output["entries"][0]["updatedAt"], "2026-10-08T20:45:00Z")

    def test_missing_page_and_future_update_fail_closed(self):
        with self.assertRaises(ValueError):
            extract(b"<html></html>", datetime(2026, 10, 10, tzinfo=timezone.utc))
        html = b'''<html><div id="AlertsPage"><table><tbody><tr><td>Future alert</td><td>Area restriction notice detail</td><td>Oct 11 2026, 1:45 PM</td></tr></tbody></table></div></html>'''
        with self.assertRaises(ValueError):
            extract(html, datetime(2026, 10, 10, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
