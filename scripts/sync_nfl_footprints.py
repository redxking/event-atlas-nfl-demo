"""One-time, rate-limited OSM candidate footprint capture for NFL venue points."""

import json
import math
import pathlib
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
games = json.loads((SITE / "nfl.json").read_text())["games"]
venues = {game["venue"]["id"]: game["venue"] for game in games}


def tags(element):
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def area_m2(ring):
    latitude = sum(point[1] for point in ring) / len(ring)
    xscale = 111_200 * math.cos(math.radians(latitude))
    yscale = 111_200
    origin_lon, origin_lat = ring[0]
    local = [((lon - origin_lon) * xscale, (lat - origin_lat) * yscale) for lon, lat in ring]
    return abs(sum(local[i][0] * local[i + 1][1] - local[i + 1][0] * local[i][1] for i in range(len(local) - 1))) / 2


def mapped_way(root, qid, point):
    nodes = {node.attrib["id"]: (float(node.attrib["lon"]), float(node.attrib["lat"])) for node in root.findall("node")}
    candidates = []
    for way in root.findall("way"):
        properties = tags(way)
        if properties.get("wikidata") != qid or not (properties.get("building") or properties.get("leisure") == "stadium"):
            continue
        refs = [node.attrib["ref"] for node in way.findall("nd")]
        if len(refs) < 4 or refs[0] != refs[-1] or any(ref not in nodes for ref in refs):
            continue
        ring = [nodes[ref] for ref in refs]
        area = area_m2(ring)
        if not 1000 <= area <= 1_000_000:
            continue
        centroid = (sum(lon for lon, _ in ring[:-1]) / (len(ring) - 1), sum(lat for _, lat in ring[:-1]) / (len(ring) - 1))
        separation = 111.2 * math.hypot(centroid[1] - point["lat"], (centroid[0] - point["lon"]) * math.cos(math.radians(point["lat"])))
        if separation > 0.6:
            continue
        candidates.append((separation, area, way, properties, ring))
    if len(candidates) != 1:
        return None, f"{len(candidates)} qualifying identity-matched polygon ways"
    separation, area, way, properties, ring = candidates[0]
    return {
        "osmType": "way",
        "osmId": int(way.attrib["id"]),
        "sourceUrl": f'https://www.openstreetmap.org/way/{way.attrib["id"]}',
        "sourceVersion": int(way.attrib["version"]),
        "sourceEditedAt": way.attrib.get("timestamp"),
        "wikidata": qid,
        "mappedName": properties.get("name"),
        "mappedFeature": {key: properties[key] for key in ("building", "leisure") if key in properties},
        "areaM2": round(area),
        "centroidSeparationKm": round(separation, 3),
        "status": "unreviewed_osm_footprint_candidate",
        "ring": [[round(lon, 7), round(lat, 7)] for lon, lat in ring],
    }, None


by_venue = {}
unmatched = {}
for venue in venues.values():
    qid = venue.get("venueCandidateUrl", "").rsplit("/", 1)[-1]
    if not qid.startswith("Q"):
        unmatched[venue["id"]] = "no Wikidata crosswalk"
        continue
    lat, lon = venue["lat"], venue["lon"]
    bbox = f"{lon - .006:.7f},{lat - .006:.7f},{lon + .006:.7f},{lat + .006:.7f}"
    url = "https://api.openstreetmap.org/api/0.6/map?" + urllib.parse.urlencode({"bbox": bbox})
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "EventAtlasNFLFootprintResearch/0.4 (public demo; one-time query)"})
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(8_000_001)
        if len(body) > 8_000_000:
            raise ValueError("OSM map response too large")
        polygon, reason = mapped_way(ET.fromstring(body), qid, venue)
        if polygon:
            by_venue[venue["id"]] = polygon
        else:
            unmatched[venue["id"]] = reason
    except Exception as error:
        unmatched[venue["id"]] = f"source check failed: {type(error).__name__}"
    print(f'{venue["name"]}: {"candidate" if venue["id"] in by_venue else unmatched[venue["id"]]}', flush=True)
    time.sleep(1)

output = {
    "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "source": "OpenStreetMap contributors",
    "licenseUrl": "https://www.openstreetmap.org/copyright",
    "method": "One-time 0.012-degree OSM map extracts at 30 unreviewed venue points. Require an exact Wikidata tag and one closed building or leisure=stadium way of plausible area within 0.6 km of the point. These community mapped geometry candidates are not approved ground security perimeters.",
    "venueCount": len(venues),
    "matched": len(by_venue),
    "byVenue": by_venue,
    "unmatched": unmatched,
}
(SITE / "ground_footprints.json").write_text(json.dumps(output, separators=(",", ":")))
print(f'{len(by_venue)}/{len(venues)} candidate footprints', flush=True)
