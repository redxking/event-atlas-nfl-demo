import importlib.util
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("sync_noaa_hms_smoke", Path(__file__).resolve().parents[1] / "scripts/sync_noaa_hms_smoke.py")
HMS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HMS)
NOW = datetime(2026, 10, 10, 2, 0, tzinfo=timezone.utc)
DAY = date(2026, 10, 9)
URL = HMS.source_url(DAY)
GAME = {"venue": {"id": "x", "lat": 34, "lon": -118}}


def kml(inner=""):
    return f'''<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>HMS Smoke Mapping-20261009</name><Placemark><description><![CDATA[Start Time: 2026282 1200UTC<br>End Time: 2026282 1800UTC<br>Density: Medium]]></description><Polygon><outerBoundaryIs><LinearRing><coordinates>-119,33 -117,33 -117,35 -119,35 -119,33</coordinates></LinearRing></outerBoundaryIs>{inner}</Polygon></Placemark></Document></kml>'''.encode()


class HmsSmokeTests(unittest.TestCase):
    def test_point_match_keeps_satellite_time_and_source(self):
        result = HMS.parse_smoke(kml(), [GAME], URL, DAY, NOW)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["byVenue"]["x"][0]["density"], "medium")
        self.assertEqual(result["byVenue"]["x"][0]["endAt"], "2026-10-09T18:00:00Z")
        self.assertEqual(result["byVenue"]["x"][0]["sourceUrl"], URL)

    def test_hole_and_wrong_date_do_not_create_match(self):
        inner = "<innerBoundaryIs><LinearRing><coordinates>-118.5,33.5 -117.5,33.5 -117.5,34.5 -118.5,34.5 -118.5,33.5</coordinates></LinearRing></innerBoundaryIs>"
        self.assertEqual(HMS.parse_smoke(kml(inner), [GAME], URL, DAY, NOW)["byVenue"], {})
        with self.assertRaisesRegex(ValueError, "date mismatch"):
            HMS.parse_smoke(kml().replace(b"20261009", b"20261008"), [GAME], URL, DAY, NOW)

    def test_dtd_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unsafe"):
            HMS.parse_smoke(b"<!DOCTYPE kml>" + kml(), [GAME], URL, DAY, NOW)


if __name__ == "__main__":
    unittest.main()
