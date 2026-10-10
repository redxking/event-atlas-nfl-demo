"""Dated city update RSS must stay bounded and source linked."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_nola_ready_updates import extract  # noqa: E402


class NolaReadyUpdatesTests(unittest.TestCase):
    def test_recent_item_keeps_publisher_date_and_canonical_page(self):
        now = datetime(2026, 10, 10, tzinfo=timezone.utc)
        raw = b'''<rss><channel><title>NOLA Ready Updates</title>
        <item><title>City advisory</title><pubDate>Fri, 09 Oct 2026 13:39:49 GMT</pubDate><link>https://ready.nola.gov/incident/new-notice/update-one/?feed=NOLA-Ready-Updates</link></item>
        <item><title>Old notice</title><pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate><link>https://ready.nola.gov/incident/old/notice/</link></item>
        </channel></rss>'''
        result = extract(raw, now)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["entries"], [{"title": "City advisory", "publishedAt": "2026-10-09T13:39:49Z", "url": "https://ready.nola.gov/incident/new-notice/update-one/"}])

    def test_external_item_fails_closed(self):
        raw = b'''<rss><channel><title>NOLA Ready Updates</title><item><title>Bad link</title><pubDate>Fri, 09 Oct 2026 13:39:49 GMT</pubDate><link>https://example.org/incident/bad/link/</link></item></channel></rss>'''
        with self.assertRaisesRegex(ValueError, "validation"):
            extract(raw, datetime(2026, 10, 10, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
