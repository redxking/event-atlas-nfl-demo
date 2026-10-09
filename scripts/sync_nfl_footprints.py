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


def read_xml(url):
    request = urllib.request.Request(url, headers={"User-Agent": "EventAtlasNFLFootprintResearch/0.4 (public demo; one-time query)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read(8_000_001)
    if len(body) > 8_000_000:
        raise ValueError("OSM response too large")
    return ET.fromstring(body)


def ring_candidate(element, properties, ring, point, identity_method, matched_qid, inner_count=0):
    if len(ring) < 4 or ring[0] != ring[-1]:
        return None
    area = area_m2(ring)
    if not 1000 <= area <= 1_000_000:
        return None
    centroid = (sum(lon for lon, _ in ring[:-1]) / (len(ring) - 1), sum(lat for _, lat in ring[:-1]) / (len(ring) - 1))
    separation = 111.2 * math.hypot(centroid[1] - point["lat"], (centroid[0] - point["lon"]) * math.cos(math.radians(point["lat"])))
    if separation > 0.6:
        return None
    kind = element.tag
    return {
        "osmType": kind,
        "osmId": int(element.attrib["id"]),
        "sourceUrl": f'https://www.openstreetmap.org/{kind}/{element.attrib["id"]}',
        "sourceVersion": int(element.attrib["version"]),
        "sourceEditedAt": element.attrib.get("timestamp"),
        "wikidata": properties.get("wikidata"),
        "matchedCandidateWikidata": matched_qid,
        "identityMethod": identity_method,
        "mappedName": properties.get("name"),
        "mappedFeature": {key: properties[key] for key in ("building", "leisure") if key in properties},
        "innerRingCount": inner_count,
        "areaM2": round(area),
        "centroidSeparationKm": round(separation, 3),
        "status": "unreviewed_osm_footprint_candidate",
        "ring": [[round(lon, 7), round(lat, 7)] for lon, lat in ring],
    }


def way_candidates(root, qid, point, method):
    nodes = {node.attrib["id"]: (float(node.attrib["lon"]), float(node.attrib["lat"])) for node in root.findall("node")}
    found = []
    for way in root.findall("way"):
        properties = tags(way)
        identity = properties.get("wikidata") == qid if method == "wikidata" else properties.get("name", "").casefold() == point["name"].casefold() and not properties.get("wikidata")
        if not identity or not (properties.get("building") or properties.get("leisure") == "stadium"):
            continue
        refs = [node.attrib["ref"] for node in way.findall("nd")]
        if len(refs) < 4 or refs[0] != refs[-1] or any(ref not in nodes for ref in refs):
            continue
        candidate = ring_candidate(way, properties, [nodes[ref] for ref in refs], point, method, qid)
        if candidate:
            found.append(candidate)
    return found


def outer_rings(root, relation):
    ways = {way.attrib["id"]: [node.attrib["ref"] for node in way.findall("nd")] for way in root.findall("way")}
    nodes = {node.attrib["id"]: (float(node.attrib["lon"]), float(node.attrib["lat"])) for node in root.findall("node")}
    outer = [member.attrib["ref"] for member in relation.findall("member") if member.attrib.get("type") == "way" and member.attrib.get("role") == "outer"]
    inner_count = sum(member.attrib.get("role") == "inner" for member in relation.findall("member"))
    if not outer or len(outer) > 8 or any(ref not in ways for ref in outer):
        return [], inner_count
    remaining = [ways[ref] for ref in outer]
    rings = []
    while remaining:
        refs = remaining.pop(0)
        while refs[-1] != refs[0] and remaining:
            for index, segment in enumerate(remaining):
                if segment[0] == refs[-1]:
                    refs += segment[1:]
                elif segment[-1] == refs[-1]:
                    refs += list(reversed(segment[:-1]))
                else:
                    continue
                remaining.pop(index)
                break
            else:
                return [], inner_count
        if len(refs) < 4 or refs[0] != refs[-1] or any(ref not in nodes for ref in refs):
            return [], inner_count
        rings.append([nodes[ref] for ref in refs])
    return rings, inner_count


def contains(point, ring):
    inside = False
    x, y = point["lon"], point["lat"]
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def relation_candidates(root, qid, point):
    found = []
    for relation in root.findall("relation"):
        properties = tags(relation)
        if properties.get("wikidata") != qid or properties.get("type") != "multipolygon" or not (properties.get("building") or properties.get("leisure") == "stadium"):
            continue
        full = read_xml(f'https://api.openstreetmap.org/api/0.6/relation/{relation.attrib["id"]}/full')
        full_relation = next((item for item in full.findall("relation") if item.attrib["id"] == relation.attrib["id"]), None)
        if full_relation is None:
            continue
        rings, inner_count = outer_rings(full, full_relation)
        if rings:
            primary = next((ring for ring in rings if contains(point, ring)), rings[0])
            candidate = ring_candidate(full_relation, properties, primary, point, "wikidata", qid, inner_count)
            if candidate:
                total_area = sum(area_m2(ring) for ring in rings)
                if total_area > 1_000_000:
                    continue
                candidate["areaM2"] = round(total_area)
                candidate["outerRingCount"] = len(rings)
                if len(rings) > 1:
                    candidate["outerRings"] = [[[round(lon, 7), round(lat, 7)] for lon, lat in ring] for ring in rings]
                found.append(candidate)
    return found


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
        root = read_xml(url)
        candidates = way_candidates(root, qid, venue, "wikidata")
        if not candidates:
            candidates = relation_candidates(root, qid, venue)
        if not candidates:
            candidates = way_candidates(root, qid, venue, "exact_name")
        if len(candidates) == 1:
            by_venue[venue["id"]] = candidates[0]
        else:
            unmatched[venue["id"]] = f"{len(candidates)} qualifying polygon candidates"
    except Exception as error:
        unmatched[venue["id"]] = f"source check failed: {type(error).__name__}"
    print(f'{venue["name"]}: {"candidate" if venue["id"] in by_venue else unmatched[venue["id"]]}', flush=True)
    time.sleep(1)

output = {
    "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "source": "OpenStreetMap contributors",
    "licenseUrl": "https://www.openstreetmap.org/copyright",
    "method": "One-time 0.012-degree OSM map extracts at 30 unreviewed venue points. Require a closed stadium/building way or assembled multipolygon outer components of plausible area within 0.6 km of the point. Match by exact Wikidata tag; use exact mapped stadium name only where the feature has no Wikidata tag. Multipolygon interior holes are counted but not drawn; reported area is an outer envelope before subtracting holes. These community mapped geometry candidates are not approved ground security perimeters.",
    "venueCount": len(venues),
    "matched": len(by_venue),
    "byVenue": by_venue,
    "unmatched": unmatched,
}
(SITE / "ground_footprints.json").write_text(json.dumps(output, separators=(",", ":")))
print(f'{len(by_venue)}/{len(venues)} candidate footprints', flush=True)
