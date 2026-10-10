"""NOLA Ready active-index extraction distinguishes the active list from archives."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_nola_ready_active import extract  # noqa: E402


class NolaReadyActiveTests(unittest.TestCase):
    def test_bounded_active_items_exclude_update_archive(self):
        page = b'''<html><body><h2>Active incidents</h2><ul class="list-inline list-button"><li><a href="/incident/new-city-notice/">New city notice</a></li></ul><h2>Updates</h2><a href="/incident/old-archive/">Old archive</a></body></html>'''
        result = extract(page, datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual([item["id"] for item in result["entries"]], ["new-city-notice"])

    def test_external_link_or_missing_active_block_fails_closed(self):
        bad = b'''<html><body><h2>Active incidents</h2><ul class="list-inline list-button"><li><a href="https://example.com/incident/test/">Bad</a></li></ul></body></html>'''
        with self.assertRaisesRegex(ValueError, "validation"):
            extract(bad, datetime.now(timezone.utc))
        with self.assertRaisesRegex(ValueError, "structure"):
            extract(b"<html><body><h2>Updates</h2></body></html>", datetime.now(timezone.utc))


if __name__ == "__main__":
    unittest.main()
