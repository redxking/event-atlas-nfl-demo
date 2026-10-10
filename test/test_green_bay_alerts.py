import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("sync_green_bay_alerts", Path(__file__).resolve().parents[1] / "scripts/sync_green_bay_alerts.py")
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)
NOW = datetime(2026, 10, 10, 6, 35, tzinfo=timezone.utc)


def feed(item=""):
    return (f'<rss version="2.0"><channel><title>{MOD.SOURCES[0]["title"]}</title><link>https://www.greenbaywi.gov/AlertCenter.aspx</link><lastBuildDate>Sat, 10 Oct 2026 00:34:47 -0600</lastBuildDate>{item}</channel></rss>').encode()


class GreenBayAlertTests(unittest.TestCase):
    def test_empty_official_category_is_a_valid_checked_response(self):
        result = MOD.parse_feed(feed(), MOD.SOURCES[0], NOW)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["activeItemCount"], 0)

    def test_item_retains_official_link_and_publisher_date(self):
        item = '<item><title>City notice</title><description>Check city updates</description><link>https://www.greenbaywi.gov/AlertCenter.aspx?AID=123</link><pubDate>Sat, 10 Oct 2026 00:00:00 -0600</pubDate></item>'
        result = MOD.parse_feed(feed(item), MOD.SOURCES[0], NOW)
        self.assertEqual(result["alerts"][0]["publishedAt"], "2026-10-10T06:00:00Z")
        self.assertEqual(result["alerts"][0]["url"], "https://www.greenbaywi.gov/AlertCenter.aspx?AID=123")

    def test_foreign_link_and_dtd_are_rejected(self):
        item = '<item><title>City notice</title><link>https://example.org/AlertCenter.aspx?AID=123</link></item>'
        with self.assertRaisesRegex(ValueError, "official link"):
            MOD.parse_feed(feed(item), MOD.SOURCES[0], NOW)
        with self.assertRaisesRegex(ValueError, "DTD"):
            MOD.parse_feed(b'<!DOCTYPE rss>' + feed(), MOD.SOURCES[0], NOW)


if __name__ == "__main__":
    unittest.main()
