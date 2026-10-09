#!/usr/bin/env python3
"""Snapshot DHS's public consolidated NTAS feed for the public demo."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

SOURCE = "https://www.dhs.gov/ntas/1.1/feed.xml"
OUTPUT = Path(__file__).resolve().parents[1] / "site" / "ntas.json"


def utc_date(value):
    return datetime.strptime(value, "%Y/%m/%d %H:%M").replace(tzinfo=timezone.utc)


def iso(value):
    return value.isoformat().replace("+00:00", "Z")


def parse_feed(payload, now):
    if len(payload) > 1_000_000 or b"<!DOCTYPE" in payload.upper() or b"<!ENTITY" in payload.upper():
        raise ValueError("Oversized feed or prohibited XML declaration")
    root = ET.fromstring(payload)
    if root.tag != "alerts":
        raise ValueError("Unexpected NTAS root element")
    if len(root) > 100 or any(child.tag != "alert" for child in root):
        raise ValueError("Unexpected NTAS entries")
    active = []
    instant = datetime.fromisoformat(now.replace("Z", "+00:00"))
    for item in root:
        start, end = utc_date(item.attrib["start"]), utc_date(item.attrib["end"])
        if not (start <= instant < end):
            continue
        url = item.attrib.get("link", "")
        if not url.startswith("https://www.dhs.gov/"):
            raise ValueError("Unexpected advisory link")
        active.append({"type": item.attrib.get("type", "Unspecified advisory"), "start": iso(start),
                       "end": iso(end), "url": url, "summary": (item.findtext("summary") or "").strip(),
                       "locations": [(node.text or "").strip() for node in item.findall("locations/location")],
                       "sectors": [(node.text or "").strip() for node in item.findall("sectors/sector")]})
    return active


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", help="Read XML from a local test fixture")
    args = parser.parse_args()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    snapshot = {"source": "DHS National Terrorism Advisory System", "sourceUrl": SOURCE,
                "retrievedAt": now, "status": "ok", "active": [], "activeCount": 0}
    try:
        if args.fixture:
            payload = Path(args.fixture).read_bytes()
        else:
            request = Request(SOURCE, headers={"User-Agent": "EventAtlasPublicDemo/1.0", "Accept": "application/xml"})
            with urlopen(request, timeout=25) as response:
                payload = response.read(1_000_001)
        snapshot["active"] = parse_feed(payload, now)
        snapshot["activeCount"] = len(snapshot["active"])
    except Exception as error:
        snapshot["status"] = "unavailable"
        snapshot["error"] = type(error).__name__
    OUTPUT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n")
    print(f"DHS NTAS: {snapshot['status']}, {snapshot['activeCount']} active advisories")


if __name__ == "__main__":
    main()
