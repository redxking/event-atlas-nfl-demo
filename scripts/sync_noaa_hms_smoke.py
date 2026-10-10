"""Bounded NOAA HMS daily smoke-polygon screening for NFL venue candidate points."""

import json
import pathlib
import re
import ssl
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
BASE = "https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML"
DOCS = "https://www.ospo.noaa.gov/products/land/hms.html"
NS = {"k": "http://www.opengis.net/kml/2.2"}


def tls_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def point_in_ring(lon, lat, ring):
    inside = False
    for index in range(len(ring) - 1):
        x1, y1 = ring[index]
        x2, y2 = ring[index + 1]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def coordinates(element):
    if element is None or not element.text:
        raise ValueError("Missing NOAA polygon coordinates")
    points = []
    for token in element.text.split():
        values = token.split(",")
        if len(values) < 2:
            raise ValueError("Invalid NOAA polygon coordinate")
        lon, lat = float(values[0]), float(values[1])
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise ValueError("Invalid NOAA polygon range")
        points.append((lon, lat))
        if len(points) > 10000:
            raise ValueError("NOAA polygon exceeds vertex limit")
    if len(points) < 4 or points[0] != points[-1]:
        raise ValueError("Unclosed NOAA polygon")
    return points


def smoke_time(description, label):
    match = re.search(rf"{label} Time: (\d{{7}}) (\d{{4}})UTC", description)
    if not match:
        raise ValueError("Missing NOAA smoke time")
    return datetime.strptime("".join(match.groups()), "%Y%j%H%M").replace(tzinfo=timezone.utc)


def parse_smoke(body, games, source_url, analysis_day, now):
    if len(body) > 5_000_000 or b"<!DOCTYPE" in body.upper() or b"<!ENTITY" in body.upper():
        raise ValueError("NOAA KML unsafe or oversized")
    root = ET.fromstring(body)
    if root.tag != "{http://www.opengis.net/kml/2.2}kml":
        raise ValueError("Unexpected NOAA KML root")
    name = root.find("k:Document/k:name", NS)
    if name is None or name.text != f"HMS Smoke Mapping-{analysis_day:%Y%m%d}":
        raise ValueError("NOAA KML date mismatch")
    placemarks = root.findall(".//k:Placemark", NS)
    if len(placemarks) > 2000:
        raise ValueError("NOAA KML exceeds polygon count")
    venues = {game["venue"]["id"]: game["venue"] for game in games if isinstance(game.get("venue", {}).get("lat"), (int, float)) and isinstance(game.get("venue", {}).get("lon"), (int, float))}
    matched = {venue_id: [] for venue_id in venues}
    latest = None
    for index, placemark in enumerate(placemarks):
        desc = placemark.find("k:description", NS)
        description = desc.text if desc is not None and desc.text else ""
        density_match = re.search(r"Density: (Light|Medium|Heavy)", description)
        if not density_match:
            raise ValueError("Missing NOAA smoke density")
        start = smoke_time(description, "Start")
        end = smoke_time(description, "End")
        if end < start or end > now + timedelta(hours=2) or end < now - timedelta(hours=48):
            continue
        latest = max(latest, end) if latest else end
        polygon = placemark.find("k:Polygon", NS)
        outer = coordinates(polygon.find("k:outerBoundaryIs/k:LinearRing/k:coordinates", NS) if polygon is not None else None)
        holes = [coordinates(item) for item in polygon.findall("k:innerBoundaryIs/k:LinearRing/k:coordinates", NS)]
        for venue_id, venue in venues.items():
            lon, lat = venue["lon"], venue["lat"]
            if point_in_ring(lon, lat, outer) and not any(point_in_ring(lon, lat, hole) for hole in holes):
                matched[venue_id].append({"polygonIndex": index, "density": density_match.group(1).lower(), "startAt": start.isoformat().replace("+00:00", "Z"), "endAt": end.isoformat().replace("+00:00", "Z"), "sourceUrl": source_url})
    by_venue = {key: sorted(value, key=lambda item: item["endAt"], reverse=True)[:3] for key, value in matched.items() if value}
    return {"schema": "event-atlas.hms-smoke.v1", "status": "ok", "builtAt": now.isoformat().replace("+00:00", "Z"), "analysisDate": analysis_day.isoformat(), "latestPolygonEndAt": latest.isoformat().replace("+00:00", "Z") if latest else None, "sourceUrl": source_url, "docsUrl": DOCS, "polygonCount": len(placemarks), "byVenue": by_venue, "interpretation": "NOAA HMS daily satellite smoke polygons screened against unreviewed venue candidate points. A point match is a dated satellite analysis, not a ground-level PM2.5 measurement, current smoke forecast, fire attribution, or stadium impact. Product availability can lag or be disrupted."}


def source_url(day):
    return f"{BASE}/{day:%Y/%m}/hms_smoke{day:%Y%m%d}.kml"


def sync(now=None):
    now = now or datetime.now(timezone.utc)
    schedule = json.loads((SITE / "nfl.json").read_text())
    if schedule.get("source", {}).get("status") != "ok" or not isinstance(schedule.get("games"), list):
        raise ValueError("NFL schedule unavailable")
    last_error = None
    for offset in (0, 1):
        day = (now - timedelta(days=offset)).date()
        url = source_url(day)
        request = urllib.request.Request(url, headers={"User-Agent": "EventAtlas NFL NOAA HMS public smoke context (https://github.com/redxking/event-atlas-nfl-demo)"})
        try:
            with urllib.request.urlopen(request, timeout=25, context=tls_context()) as response:
                if response.url != url or response.status != 200:
                    raise ValueError("Unexpected NOAA source response")
                body = response.read(5_000_001)
            return parse_smoke(body, schedule["games"], url, day, now)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, ET.ParseError) as error:
            last_error = error
    raise ValueError(f"NOAA HMS source unavailable: {last_error}")


if __name__ == "__main__":
    now = datetime.now(timezone.utc)
    try:
        snapshot = sync(now)
    except Exception as error:
        snapshot = {"schema": "event-atlas.hms-smoke.v1", "status": "failed", "builtAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": DOCS, "docsUrl": DOCS, "byVenue": {}, "error": str(error)[:160]}
    (SITE / "hms_smoke.json").write_text(json.dumps(snapshot, separators=(",", ":")) + "\n")
    print(f"NOAA HMS smoke: {snapshot['status']}; {len(snapshot['byVenue'])} venues with dated polygon candidates")
