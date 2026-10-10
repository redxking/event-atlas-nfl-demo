"""Retain bounded, official Houston TranStar corridor RSS observations."""

import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://traffic.houstontranstar.org/data/rss/"
FEEDS = {"incidents": BASE + "incidents_rss.xml", "lane_closures": BASE + "laneclosures_rss.xml"}
SCHEMA = "event-atlas.houston-transtar-rss.v1"
CORRIDOR = re.compile(r"\b(?:IH[- ]?610 South Loop|SH[- ]?288|South Main St|Main Street)\b", re.I)


def clean(value, limit):
    value = " ".join((value or "").split())
    if not value or len(value) > limit:
        raise ValueError("Houston TranStar field invalid")
    return value


def timestamp(value, now):
    date = parsedate_to_datetime(value)
    if date.tzinfo is None:
        raise ValueError("Houston TranStar timestamp lacks timezone")
    date = date.astimezone(timezone.utc)
    if date > now + timedelta(minutes=5):
        raise ValueError("Houston TranStar timestamp in future")
    return date.isoformat().replace("+00:00", "Z")


def parse_feed(raw, kind, now):
    if len(raw) > 250_000 or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("Houston TranStar RSS invalid or oversized")
    root = ET.fromstring(raw.decode("utf-8-sig"))
    channel = root.find("channel")
    if root.tag != "rss" or channel is None or clean(channel.findtext("title"), 100) != {"incidents": "Houston TranStar Incidents", "lane_closures": "Houston TranStar Lane Closures"}[kind]:
        raise ValueError("Houston TranStar RSS identity mismatch")
    source_at = timestamp(clean(channel.findtext("pubDate"), 80), now)
    if (now - datetime.fromisoformat(source_at.replace("Z", "+00:00"))).total_seconds() > 1800:
        raise ValueError("Houston TranStar RSS publisher date stale")
    items = channel.findall("item")
    if len(items) > 500:
        raise ValueError("Houston TranStar RSS item bound exceeded")
    selected = []
    for item in items:
        title = clean(item.findtext("title"), 220)
        description = clean(item.findtext("description"), 700)
        guid = clean(item.findtext("guid"), 100)
        if not re.fullmatch(r"[0-9]+_[A-Za-z ]{2,30}", guid):
            raise ValueError("Houston TranStar RSS GUID invalid")
        item_at = timestamp(clean(item.findtext("pubDate"), 80), now)
        if item_at != source_at:
            raise ValueError("Houston TranStar item timestamp differs from feed")
        if CORRIDOR.search(title):
            selected.append({"id": guid, "title": title, "description": description, "sourceAt": item_at, "sourceTextSha256": hashlib.sha256((guid + "\n" + title + "\n" + description).encode()).hexdigest(), "sourceUrl": FEEDS[kind]})
    return {"status": "ok", "sourceAt": source_at, "totalListed": len(items), "corridorListed": len(selected), "entries": selected[:20], "sourceUrl": FEEDS[kind]}


def fetch(url):
    result = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", url], capture_output=True, timeout=30, check=True)
    raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
    if status != "200" or effective != url:
        raise ValueError("Unexpected Houston TranStar RSS response")
    return raw


def main():
    now = datetime.now(timezone.utc)
    feeds = {}
    for kind, url in FEEDS.items():
        try:
            feeds[kind] = parse_feed(fetch(url), kind, now)
        except Exception as error:
            feeds[kind] = {"status": "failed", "sourceAt": None, "totalListed": None, "corridorListed": None, "entries": [], "sourceUrl": url}
            print(f"Houston TranStar {kind} unavailable: {str(error)[:120]}")
    status = "ok" if all(item["status"] == "ok" for item in feeds.values()) else "partial" if any(item["status"] == "ok" for item in feeds.values()) else "failed"
    output = {"schema": SCHEMA, "status": status, "checkedAt": now.isoformat().replace("+00:00", "Z"), "feeds": feeds, "interpretation": "RSS corridor text matches only. No coordinates, venue route, exact closure window, or event impact are verified; item pubDate is the feed publication time."}
    (ROOT / "site/houston_transtar_rss.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Houston TranStar RSS: {status}; {sum(len(item['entries']) for item in feeds.values())} retained corridor rows")


if __name__ == "__main__":
    main()
