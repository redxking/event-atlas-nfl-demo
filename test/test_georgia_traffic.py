import unittest
from datetime import datetime, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_georgia_traffic.py"
spec = spec_from_file_location("sync_georgia_traffic", path)
module = module_from_spec(spec)
spec.loader.exec_module(module)


class GeorgiaTrafficTests(unittest.TestCase):
    def test_county_filter_preserves_publisher_wall_time_without_utc_claim(self):
        now = datetime(2026, 10, 10, 8, 15, tzinfo=timezone.utc)
        rows = [
            {"event_id": 123, "county": "Fulton", "eventType": "Crash", "type": "crash", "status": "Confirmed", "primary_road": "I-20", "cross_road": "I-75", "description": "Public road description", "modified_date": 1791605657680, "start_time": 1791604458000, "end_time": 1791606258000},
            {"event_id": 124, "county": "Fulton", "eventType": "Incidents", "type": "roadwork", "status": "Confirmed", "modified_date": 1789997538097},
            {"event_id": 456, "county": "DeKalb", "modified_date": 1791605657680},
        ]
        result = module.extract(rows, now)
        self.assertEqual(result["countyCount"], 2)
        self.assertEqual(result["recentCountyCount"], 1)
        self.assertEqual(result["olderOmittedCount"], 1)
        self.assertEqual(result["records"][0]["publisherDisplayedUpdated"], "2026-10-10 04:14")
        self.assertEqual(result["timeBasis"], "publisher_displayed_wall_time_unverified_zone")
        self.assertNotIn("updatedAt", result["records"][0])

    def test_rejects_unbounded_or_malformed_table(self):
        now = datetime.now(timezone.utc)
        with self.assertRaises(ValueError):
            module.extract({"data": []}, now)
        with self.assertRaises(ValueError):
            module.extract([{}] * 1001, now)


if __name__ == "__main__":
    unittest.main()
