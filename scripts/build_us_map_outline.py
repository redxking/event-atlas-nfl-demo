"""Build a compact contiguous-US reference outline from Census 2025 KML."""

from hashlib import sha256
from html import escape
from io import BytesIO
from pathlib import Path
import re
from urllib.request import urlopen
from xml.etree import ElementTree as ET
from zipfile import ZipFile


SOURCE = "https://www2.census.gov/geo/tiger/GENZ2025/kml/cb_2025_us_state_20m.zip"
OUT = Path(__file__).resolve().parents[1] / "site" / "us_states.svg"
NS = {"k": "http://www.opengis.net/kml/2.2"}
EXCLUDED = {"AK", "HI", "PR", "AS", "GU", "MP", "VI"}


def point(longitude, latitude):
    return round((longitude + 126) * 1000 / 61, 1), round((50 - latitude) * 570 / 26, 1)


def main():
    payload = urlopen(SOURCE, timeout=30).read()
    if len(payload) > 1_000_000:
        raise ValueError("Census archive exceeds expected size")
    with ZipFile(BytesIO(payload)) as archive:
        root = ET.fromstring(archive.read("cb_2025_us_state_20m.kml"))
    paths = []
    states = set()
    for placemark in root.findall(".//k:Placemark", NS):
        description = placemark.findtext("k:description", default="", namespaces=NS)
        match = re.search(r"<th>STUSPS</th>\s*<td>([A-Z]{2})</td>", description)
        if not match:
            raise ValueError("State abbreviation missing from Census KML")
        state = match.group(1)
        if state in EXCLUDED:
            continue
        states.add(state)
        for polygon in placemark.findall(".//k:Polygon", NS):
            raw = polygon.findtext("k:outerBoundaryIs/k:LinearRing/k:coordinates", default="", namespaces=NS)
            coordinates = []
            for entry in raw.split():
                longitude, latitude = map(float, entry.split(",")[:2])
                if not -126 <= longitude <= -65 or not 24 <= latitude <= 50:
                    raise ValueError(f"Unexpected coordinate for {state}")
                coordinates.append(point(longitude, latitude))
            if len(coordinates) < 4:
                raise ValueError(f"Incomplete polygon for {state}")
            path = "M" + "L".join(f"{x},{y}" for x, y in coordinates) + "Z"
            paths.append(f'<path d="{path}" data-state="{escape(state)}"/>')
    if len(states) != 49 or len(paths) < 49:
        raise ValueError(f"Expected 48 contiguous states and DC; got {len(states)} states")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 570" role="img" '
           f'aria-label="Generalized contiguous United States state boundaries">'
           f'<!-- Census 2025 1:20m cartographic boundaries; source {SOURCE}; sha256 {sha256(payload).hexdigest()} -->'
           f'<g fill="#142a40" stroke="#38546c" stroke-width="1.1">'
           + "".join(paths) + "</g></svg>\n")
    OUT.write_text(svg)
    print(f"Wrote {OUT} with {len(states)} states and {len(paths)} polygons")


if __name__ == "__main__":
    main()
