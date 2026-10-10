"""The city newsroom connector must keep dated headlines separate from alerts."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_nashville_oem_news import extract  # noqa: E402


class NashvilleOemNewsTests(unittest.TestCase):
    def test_recent_and_old_releases(self):
        raw = b'''<main>
        <a href="/departments/emergency-management/news/recent-release" class="news-link news-link--desktop"><div class="news--title">Recent &amp; Dated Release</div><time datetime="2026-10-09T18:00:00Z">October 9</time></a>
        <a href="/departments/emergency-management/news/older-release" class="news-link news-link--desktop"><div class="news--title">Older Release</div><time datetime="2026-09-18T18:00:00Z">September 18</time></a>
        </main>'''
        result = extract(raw, datetime(2026, 10, 10, tzinfo=timezone.utc))
        self.assertEqual(result["lastPublishedAt"], "2026-10-09T18:00:00Z")
        self.assertEqual([item["title"] for item in result["recent"]], ["Recent & Dated Release"])
        self.assertEqual(result["recent"][0]["url"], "https://www.nashville.gov/departments/emergency-management/news/recent-release")

    def test_listing_without_dated_release_fails_closed(self):
        raw = b'<a href="/departments/emergency-management/news/undated" class="news-link--desktop"><div class="news--title">Undated Release</div></a>'
        with self.assertRaises(ValueError):
            extract(raw, datetime(2026, 10, 10, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
