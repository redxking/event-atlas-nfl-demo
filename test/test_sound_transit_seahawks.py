import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_sound_transit_seahawks.py"
spec = importlib.util.spec_from_file_location("sound_transit_seahawks", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def page(north_last="11:44 a.m."):
    body = f"""<html><body><h1>Seahawks vs. San Francisco</h1>
    <p>October 11, 2026 | 1:25 p.m. - 5:00 p.m.</p><p>Lumen Field</p>
    <p>Sounder trips to and from this game</p>
    <h2>N Line from Everett to Seattle</h2><p>Trip 1831 1833 Seattle 11:19 a.m. {north_last}</p>
    <h2>S Line from Lakewood to Seattle</h2><p>Trip 1630 1632 1634 Seattle 11:07 a.m. 11:27 a.m. 11:42 a.m.</p>
    <h2>Return schedule - from Seattle/King Street Station</h2>
    <p>N Line trains depart King Street Station 20 and 45 minutes after the game ends</p>
    <p>S Line trains depart King Street Station approximately 10, 20 and 45 minutes after the game ends</p>
    <p>The T Line will also provide additional connecting service to Tacoma Station</p>
    <p>{'Operator event details. ' * 60}</p></body></html>"""
    return body.encode()


class SoundTransitSeahawksTests(unittest.TestCase):
    def test_exact_event_schedule_is_bounded_and_dated(self):
        record = module.parse_page(page(), datetime(2026, 10, 10, tzinfo=timezone.utc))
        self.assertEqual(record["status"], "ok")
        self.assertEqual(len(record["arrivals"]), 5)
        self.assertEqual(record["arrivals"][1]["seattleArrivalAt"], "2026-10-11T11:44:00-07:00")
        self.assertEqual(record["northReturnMinutesAfterGameEnd"], [20, 45])

    def test_missing_trip_time_is_not_published_as_current(self):
        with self.assertRaises(ValueError):
            module.parse_page(page(north_last="unavailable"), datetime(2026, 10, 10, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
