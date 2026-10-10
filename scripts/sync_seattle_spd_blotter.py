"""Capture bounded, dated headlines from the official Seattle Police Blotter RSS."""

import json
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://spdblotter.seattle.gov/feed/"
SCHEMA = "event-atlas.seattle-spd-blotter.v1"


def utc(value):
    result = parsedate_to_datetime(value)
    if result.tzinfo is None:
        raise ValueError("RSS date lacks timezone")
    return result.astimezone(timezone.utc)


def iso(value):
    return value.isoformat().replace("+00:00", "Z")


def extract(raw, now):
    if not raw or len(raw) > 250_000:
        raise ValueError("Unexpected SPD RSS size")
    channel = ET.fromstring(raw).find("channel")
    if channel is None or channel.findtext("title") != "SPD Blotter":
        raise ValueError("Unexpected SPD RSS channel")
    built = utc(channel.findtext("lastBuildDate") or "")
    if built > now + timedelta(minutes=5):
        raise ValueError("Future SPD publisher time")
    items = channel.findall("item")
    if not 1 <= len(items) <= 100:
        raise ValueError("Unexpected SPD item count")
    recent, seen = [], set()
    for item in items:
        title = " ".join((item.findtext("title") or "").split())
        link = (item.findtext("link") or "").strip()
        published = utc(item.findtext("pubDate") or "")
        parsed = urlparse(link)
        if not 3 <= len(title) <= 180 or parsed.scheme != "https" or parsed.netloc != "spdblotter.seattle.gov" or not parsed.path.startswith("/20") or parsed.query or parsed.fragment or published > now + timedelta(minutes=5) or link in seen:
            raise ValueError("Invalid SPD item")
        seen.add(link)
        if published >= now - timedelta(days=7):
            recent.append({"title": title, "publishedAt": iso(published), "url": link})
    recent.sort(key=lambda item: item["publishedAt"], reverse=True)
    return {"schema": SCHEMA, "status": "ok", "checkedAt": iso(now), "sourceBuildAt": iso(built), "sourceUrl": URL, "recent": recent[:10], "interpretation": "Official SPD Blotter citywide headlines for discovery. A title is not a live police alert, a verified event-area incident, or a threat finding."}


def main():
    now = datetime.now(timezone.utc)
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 Seattle-SPD-blotter", URL]
    try:
        result = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "spdblotter.seattle.gov" or final.path != "/feed/" or final.query:
            raise ValueError("Unexpected SPD RSS redirect or status")
        output = extract(raw, now)
    except Exception as error:
        output = {"schema": SCHEMA, "status": "failed", "checkedAt": iso(now), "sourceBuildAt": None, "sourceUrl": URL, "recent": [], "interpretation": "SPD Blotter check unavailable; no negative finding follows."}
        print(f"SPD Blotter unavailable: {str(error)[:120]}")
    (ROOT / "site/seattle_spd_blotter.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"SPD Blotter: {output['status']}; {len(output['recent'])} recent headlines")


if __name__ == "__main__":
    main()
