import unittest
from datetime import datetime, timezone

from scripts.sync_seattle_spd_blotter import extract


class SeattleSpdBlotterTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 10, 14, 0, tzinfo=timezone.utc)
        self.rss = b'''<rss version="2.0"><channel><title>SPD Blotter</title>
<lastBuildDate>Sat, 10 Oct 2026 13:35:25 +0000</lastBuildDate>
<item><title>City notice</title><link>https://spdblotter.seattle.gov/2026/10/10/city-notice/</link><pubDate>Sat, 10 Oct 2026 13:35:19 +0000</pubDate></item>
<item><title>Older notice</title><link>https://spdblotter.seattle.gov/2026/09/01/older-notice/</link><pubDate>Tue, 01 Sep 2026 13:35:19 +0000</pubDate></item>
</channel></rss>'''

    def test_recent_official_headline_retains_date_and_link(self):
        result = extract(self.rss, self.now)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(len(result['recent']), 1)
        self.assertEqual(result['recent'][0]['publishedAt'], '2026-10-10T13:35:19Z')

    def test_external_link_and_future_publisher_clock_fail(self):
        with self.assertRaises(ValueError):
            extract(self.rss.replace(b'spdblotter.seattle.gov/2026/10/10', b'example.com/2026/10/10'), self.now)
        with self.assertRaises(ValueError):
            extract(self.rss.replace(b'10 Oct 2026 13:35:25', b'10 Oct 2026 16:35:25'), self.now)


if __name__ == '__main__':
    unittest.main()
