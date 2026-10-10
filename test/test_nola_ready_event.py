"""The city event connector must fail closed on unrelated or changed pages."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_nola_ready_event import extract, parse_page  # noqa: E402


class NolaReadyEventTests(unittest.TestCase):
    def test_exact_city_notice(self):
        body = "Crescent City Blues & BBQ Festival 2026 - NOLA Ready Fri Oct 09 2026 8:39 AM "
        body += "Sunday, Oct. 11 , 11:00 a.m. to 8:30 p.m. "
        body += "Central Business District, including Lafayette Square, Gallier Hall, and the surrounding blocks of St. Charles Avenue and Camp Street. "
        body += "Expect road closures, traffic delays, and heavy pedestrian traffic during the event. "
        body += "Camp Street at N. Maestri : Closed from 7:00 p.m. Thursday, Oct. 8, until 8:30 p.m. Sunday, Oct. 11. "
        body = parse_page(("<html><body>" + body + " filler" * 110 + "</body></html>").encode())
        result = extract(body, datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["claims"]), 4)

    def test_wrong_page_fails_closed(self):
        raw = ("<html><body>Unrelated event " + "text " * 170 + "</body></html>").encode()
        with self.assertRaisesRegex(ValueError, "identity"):
            parse_page(raw)
        self.assertEqual(extract("", datetime.now(timezone.utc))["status"], "failed")


if __name__ == "__main__":
    unittest.main()
