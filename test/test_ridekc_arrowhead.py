import importlib.util
import io
import unittest
import zipfile
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/sync_ridekc_arrowhead.py"
SPEC = importlib.util.spec_from_file_location("sync_ridekc_arrowhead", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def make_feed(exception=""):
    tables = {
        "agency.txt": "agency_id,agency_name,agency_timezone\nKCATA,Kansas City Area Transportation Authority,America/Chicago\n",
        "feed_info.txt": "feed_publisher_name,feed_start_date,feed_end_date,feed_version\nKansas City Area Transportation Authority,20261004,20270102,October 2026_20261001\n",
        "calendar.txt": "service_id,sunday,start_date,end_date\nsun,1,20261004,20270102\n",
        "calendar_dates.txt": "service_id,date,exception_type\n" + exception,
        "routes.txt": "route_id,route_short_name,route_long_name\n47,47,Martin Luther King Jr.\n",
        "trips.txt": "route_id,service_id,trip_id\n47,sun,trip1\n",
        "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\n4707,Blue Ridge Cutoff,39.049498,-94.475532\nfar,Far Stop,40,-95\n",
        "stop_times.txt": "trip_id,arrival_time,stop_id\ntrip1,15:10:00,4707\ntrip1,15:20:00,far\n",
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in tables.items():
            archive.writestr(name, content)
    return buffer.getvalue()


class RidekcArrowheadTests(unittest.TestCase):
    def test_nearby_event_date_calls_are_bounded_and_source_dated(self):
        result = MODULE.parse_gtfs(make_feed(), "2026-10-10T14:00:00Z")
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["nearbyRoutes"][0]["routeShortName"], "47")
        self.assertEqual(result["nearbyRoutes"][0]["scheduledStopCallsInWindow"], 1)
        self.assertEqual(result["nearbyRoutes"][0]["nearestStops"][0]["id"], "4707")
        self.assertEqual(result["timeZone"], "America/Chicago")

    def test_calendar_exception_removes_sunday_service(self):
        result = MODULE.parse_gtfs(make_feed("sun,20261018,2\n"), "2026-10-10T14:00:00Z")
        self.assertEqual(result["nearbyRoutes"], [])

    def test_alert_match_is_a_notice_not_confirmed_service(self):
        page = b"<html><body>RideKC Q4 Service Change Expires 10/16/2026 Cause Other Effect Modified Service RideKC is making service changes to Routes 47 and 50.</body></html>"
        self.assertEqual(MODULE.parse_alert_page(page)["state"], "route_change_notice_listed")
        self.assertEqual(MODULE.parse_alert_page(page.replace(b"Routes 47 and 50", b"Routes 18 and 27"))["state"], "no_matching_route_change_notice_on_page")


if __name__ == "__main__":
    unittest.main()
