import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_houston_transtar_rss import parse_feed  # noqa: E402


NOW = datetime(2026, 10, 10, 13, 5, tzinfo=timezone.utc)


def rss(title, items):
    return (f'<rss version="2.0"><channel><title>{title}</title><pubDate>Sat, 10 Oct 2026 13:00:15 GMT</pubDate>{items}</channel></rss>').encode()


class HoustonTranstarRssTest(unittest.TestCase):
    def test_retains_only_bounded_corridor_text_without_location_claim(self):
        items = '''<item><title>IH-610 South Loop Eastbound Before Scott St - Stall</title><description>Status: Verified at 7:32 AM</description><pubDate>Sat, 10 Oct 2026 13:00:15 GMT</pubDate><guid>1854994_Verified</guid></item><item><title>IH-10 Katy Westbound At Park Ten - Stall</title><description>Status: Cleared at 7:40 AM</description><pubDate>Sat, 10 Oct 2026 13:00:15 GMT</pubDate><guid>1854995_Cleared</guid></item>'''
        data = parse_feed(rss('Houston TranStar Incidents', items), 'incidents', NOW)
        self.assertEqual(data['totalListed'], 2)
        self.assertEqual(data['corridorListed'], 1)
        self.assertEqual(data['entries'][0]['id'], '1854994_Verified')
        self.assertNotIn('lat', data['entries'][0])

    def test_rejects_stale_or_mismatched_feed(self):
        with self.assertRaises(ValueError):
            parse_feed(rss('Other Feed', ''), 'incidents', NOW)
        with self.assertRaises(ValueError):
            parse_feed(rss('Houston TranStar Incidents', ''), 'incidents', datetime(2026, 10, 10, 14, tzinfo=timezone.utc))
        with self.assertRaises(ValueError):
            parse_feed(b'<!DOCTYPE rss><rss/>', 'incidents', NOW)


if __name__ == '__main__':
    unittest.main()
