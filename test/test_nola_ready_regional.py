"""Fail closed on unrelated or changed regional festival pages."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_nola_ready_regional import extract, parse_page  # noqa: E402


class NolaReadyRegionalTests(unittest.TestCase):
    def test_exact_page_and_claims(self):
        text = "National Fried Chicken Festival 2026 - NOLA Ready Fri Oct 09 2026 8:34 AM "
        text += "Sunday, Oct. 11 , 11:00 a.m. to 9:00 p.m. "
        text += "Lakefront and Gentilly, including the area around the UNO Lakefront Arena, Franklin Avenue, and Leon C. Simon Drive. "
        text += "Expect traffic delays and heavy pedestrian traffic during the event. The New Orleans Police Department will provide traffic control at Franklin Avenue and Leon C. Simon Drive. "
        body = parse_page(("<html><body>" + text + " filler" * 110 + "</body></html>").encode())
        result = extract(body, datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual([item["id"] for item in result["claims"]], ["sunday_window", "lakefront_location", "traffic_advisory"])

    def test_wrong_identity_fails_closed(self):
        raw = ("<html><body>Unrelated event " + "text " * 170 + "</body></html>").encode()
        with self.assertRaisesRegex(ValueError, "identity"):
            parse_page(raw)
        self.assertEqual(extract("", datetime.now(timezone.utc))["status"], "failed")


if __name__ == "__main__":
    unittest.main()
