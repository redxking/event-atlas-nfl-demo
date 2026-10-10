"""Capture recent dated NOLA Ready updates without copying article bodies."""

import json
import re
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse, urlunparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://ready.nola.gov/incident/?rss=NOLA-Ready-Updates"


def extract(raw, now):
    if not raw or len(raw) > 1_000_000:
        raise ValueError("NOLA Ready RSS is empty or oversized")
    root = ET.fromstring(raw)
    channel = root.find("channel")
    if root.tag != "rss" or channel is None or channel.findtext("title") != "NOLA Ready Updates":
        raise ValueError("Unexpected NOLA Ready RSS structure")
    all_items = channel.findall("item")
    if len(all_items) > 2_000:
        raise ValueError("NOLA Ready RSS exceeded the bounded item count")
    entries = []
    seen = set()
    for item in all_items:
        title = " ".join((item.findtext("title") or "").split())
        published = parsedate_to_datetime(item.findtext("pubDate") or "")
        link = urlparse((item.findtext("link") or "").strip())
        if not 3 <= len(title) <= 180 or published.tzinfo is None or link.scheme != "https" or link.hostname != "ready.nola.gov" or not re.fullmatch(r"/incident/[^/?#]+/[^/?#]+/", link.path, re.I) or link.query not in ("", "feed=NOLA-Ready-Updates") or link.fragment:
            raise ValueError("NOLA Ready RSS item failed validation")
        canonical = urlunparse(("https", "ready.nola.gov", link.path, "", "", ""))
        if canonical in seen:
            raise ValueError("Duplicate NOLA Ready RSS item")
        seen.add(canonical)
        at = published.astimezone(timezone.utc)
        if now - timedelta(days=7) <= at <= now + timedelta(minutes=5):
            entries.append({"title": title, "publishedAt": at.isoformat().replace("+00:00", "Z"), "url": canonical})
    entries.sort(key=lambda entry: entry["publishedAt"], reverse=True)
    return {"schema": "event-atlas.nola-ready-updates.v1", "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "entries": entries[:20], "interpretation": "Recent city RSS update titles and publisher times. Each link needs page verification; citywide publication alone does not establish stadium relevance or a threat."}


def main():
    now = datetime.now(timezone.utc)
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 city-update-rss", URL]
    try:
        result = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "ready.nola.gov" or final.path != "/incident/" or final.query != "rss=NOLA-Ready-Updates":
            raise ValueError("Unexpected NOLA Ready RSS redirect or status")
        output = extract(raw, now)
    except Exception as error:
        output = {"schema": "event-atlas.nola-ready-updates.v1", "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "entries": [], "interpretation": "City update RSS unavailable; no negative finding follows."}
        print(f"NOLA Ready updates unavailable: {str(error)[:120]}")
    (ROOT / "site/nola_ready_updates.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"NOLA Ready updates: {output['status']}; {len(output['entries'])} recent")


if __name__ == "__main__":
    main()
