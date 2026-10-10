"""Bounded event-date GTFS planning context near Arrowhead's candidate point."""

import csv
import hashlib
import io
import json
import math
import re
import subprocess
import zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
GTFS_URL = "https://ridekc.org/static-gtfs"
ALERT_URL = "https://ridekc.org/getting-around/service-alerts/"
VENUE_LAT, VENUE_LON = 39.048888888, -94.483888888
REQUIRED = {"agency.txt", "feed_info.txt", "calendar.txt", "calendar_dates.txt", "routes.txt", "trips.txt", "stops.txt", "stop_times.txt"}


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def fetch_public(url, maximum):
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2",
               "--proto-redir", "=https", "--compressed", "--max-time", "30", "--write-out",
               "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-transit-planning", url]
    response = subprocess.run(command, capture_output=True, timeout=35, check=True)
    raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
    if not marker or len(raw) > maximum:
        raise ValueError("RideKC response missing metadata or too large")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
    final = urlparse(effective)
    if status != "200" or final.scheme != "https" or final.hostname != "ridekc.org":
        raise ValueError("Unexpected RideKC response origin or status")
    return raw, effective


def km(lat, lon):
    return 111.2 * math.hypot(lat - VENUE_LAT, (lon - VENUE_LON) * math.cos(math.radians(VENUE_LAT)))


def parse_gtfs(raw, checked_at, kickoff="2026-10-18T20:25:00Z"):
    if not raw or len(raw) > 5_000_000:
        raise ValueError("RideKC GTFS is empty or oversized")
    event_local = datetime.fromisoformat(kickoff.replace("Z", "+00:00")).astimezone(ZoneInfo("America/Chicago"))
    event_date = event_local.strftime("%Y%m%d")
    start_minute = event_local.hour * 60 + event_local.minute - 270
    end_minute = event_local.hour * 60 + event_local.minute + 300
    if start_minute < 0 or end_minute > 24 * 60:
        raise ValueError("RideKC event window crosses a GTFS service day")
    window = f"{start_minute // 60:02d}:{start_minute % 60:02d}–{end_minute // 60:02d}:{end_minute % 60:02d} on {event_local.strftime('%B')} {event_local.day}, {event_local.year}"
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if not REQUIRED.issubset(archive.namelist()) or sum(item.file_size for item in archive.infolist()) > 35_000_000:
            raise ValueError("RideKC GTFS is missing required tables or too large")

        def rows(name):
            with archive.open(name) as stream:
                yield from csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig"))

        agency = next(rows("agency.txt"))
        feed = next(rows("feed_info.txt"))
        if agency.get("agency_timezone") != "America/Chicago" or feed.get("feed_publisher_name") != "Kansas City Area Transportation Authority":
            raise ValueError("RideKC feed identity or timezone changed")
        if not (feed.get("feed_start_date", "") <= event_date <= feed.get("feed_end_date", "")):
            raise ValueError("RideKC feed does not cover event date")
        weekday = event_local.strftime("%A").lower()
        services = {item["service_id"] for item in rows("calendar.txt") if item.get(weekday) == "1" and item.get("start_date", "") <= event_date <= item.get("end_date", "")}
        for item in rows("calendar_dates.txt"):
            if item.get("date") != event_date:
                continue
            if item.get("exception_type") == "1":
                services.add(item["service_id"])
            elif item.get("exception_type") == "2":
                services.discard(item["service_id"])
        routes = {item["route_id"]: item for item in rows("routes.txt")}
        trips = {item["trip_id"]: item for item in rows("trips.txt") if item.get("service_id") in services}
        stops = {}
        for item in rows("stops.txt"):
            try:
                lat, lon = float(item["stop_lat"]), float(item["stop_lon"])
            except (ValueError, KeyError):
                continue
            distance = km(lat, lon)
            if distance <= 1.2:
                stops[item["stop_id"]] = {"id": item["stop_id"], "name": item.get("stop_name", "")[:120], "distanceKm": round(distance, 2)}
        if len(stops) > 100:
            raise ValueError("Unexpectedly many RideKC stops near venue candidate")
        by_route = {}
        for item in rows("stop_times.txt"):
            trip = trips.get(item.get("trip_id"))
            stop = stops.get(item.get("stop_id"))
            if not trip or not stop:
                continue
            route = routes.get(trip.get("route_id"))
            time = item.get("arrival_time", "").strip()
            if not route or not re.fullmatch(r"(?:0?\d|1\d|2[0-9]):[0-5]\d:[0-5]\d", time):
                continue
            hours, minutes, seconds = map(int, time.split(":"))
            minute = hours * 60 + minutes + seconds / 60
            if minute < start_minute or minute > end_minute:
                continue
            key = route.get("route_short_name", "")
            entry = by_route.setdefault(key, {"routeId": trip["route_id"], "routeShortName": key,
                                               "routeLongName": route.get("route_long_name", "")[:120],
                                               "calls": [], "stops": {}})
            entry["calls"].append((minute, time, stop["id"]))
            entry["stops"][stop["id"]] = stop
        summaries = []
        for entry in by_route.values():
            calls = sorted(entry.pop("calls"))
            stop_list = sorted(entry.pop("stops").values(), key=lambda stop: stop["distanceKm"])
            summaries.append({**entry, "nearbyStopCount": len(stop_list), "nearestStops": stop_list[:4], "scheduledStopCallsInWindow": len(calls),
                              "firstCallLocal": calls[0][1], "lastCallLocal": calls[-1][1]})
        summaries.sort(key=lambda entry: entry["nearestStops"][0]["distanceKm"])
        return {"schema": "event-atlas.ridekc-arrowhead.v1", "status": "ok", "checkedAt": checked_at,
                "gameId": "nfl:401873006", "venueId": "3622", "eventDate": event_local.date().isoformat(), "kickoff": kickoff,
                "timeZone": "America/Chicago", "sourceUrl": GTFS_URL, "feedVersion": feed.get("feed_version", "")[:120],
                "feedStartDate": feed["feed_start_date"], "feedEndDate": feed["feed_end_date"],
                "feedSha256": hashlib.sha256(raw).hexdigest(), "radiusKm": 1.2,
                "windowLocal": window, "nearbyRoutes": summaries[:5],
                "interpretation": "Static operator timetable near an unreviewed venue point; straight-line distance is not a walking route or stadium entrance. Scheduled calls do not verify actual bus service, arrival, crowd movement, venue access, or threat."}


def parse_alert_page(raw):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("RideKC service-alert page is invalid")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    text = " ".join(" ".join(parser.parts).split())
    match = re.search(r"RideKC Q4 Service Change\s+Expires\s+10/16/2026.{0,250}?Routes 47 and 50", text, re.I)
    return {"state": "route_change_notice_listed" if match else "no_matching_route_change_notice_on_page",
            "noticeTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest() if match else None,
            "note": "The public alert page lists a Route 47 and 50 service change expiring October 16; exact October 18 stop times require operator confirmation." if match else "No matching Route 47 service-change notice in this page check; this is not a no-alert finding."}


def main():
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        schedule = json.loads((ROOT / "site/nfl.json").read_text())
        game = next(item for item in schedule["games"] if item["id"] == "nfl:401873006")
        if game["venue"]["id"] != "3622" or game.get("timeTbd"):
            raise ValueError("Exact Chiefs game or kickoff unavailable")
        kickoff = game["kickoff"]
        raw, effective = fetch_public(GTFS_URL, 5_000_000)
        if not effective.lower().endswith(".zip"):
            raise ValueError("RideKC GTFS redirect is not a ZIP")
        output = parse_gtfs(raw, now, kickoff)
        output["feedDownloadUrl"] = effective
    except Exception as error:
        output = {"schema": "event-atlas.ridekc-arrowhead.v1", "status": "failed", "checkedAt": now,
                  "gameId": "nfl:401873006", "venueId": "3622", "eventDate": "2026-10-18",
                  "sourceUrl": GTFS_URL, "nearbyRoutes": [], "error": str(error)[:140]}
    try:
        raw, _ = fetch_public(ALERT_URL, 1_000_000)
        output["serviceAlerts"] = {**parse_alert_page(raw), "sourceUrl": ALERT_URL, "checkedAt": now}
    except Exception as error:
        output["serviceAlerts"] = {"state": "unavailable", "sourceUrl": ALERT_URL, "checkedAt": now,
                                    "error": str(error)[:120]}
    (ROOT / "site/ridekc_arrowhead.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"RideKC Arrowhead: {output['status']}; {len(output['nearbyRoutes'])} nearby route(s); alert {output['serviceAlerts']['state']}")


if __name__ == "__main__":
    main()
