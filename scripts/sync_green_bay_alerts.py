"""Capture Green Bay's official active emergency and police alert RSS channels."""

import html
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    {"kind": "emergency", "title": "Green Bay, WI - Alert Center - Emergency Alerts", "url": "https://www.greenbaywi.gov/RSSFeed.aspx?CID=Emergency-Alerts-11&ModID=63"},
    {"kind": "police", "title": "Green Bay, WI - Alert Center - Police Department Alerts", "url": "https://www.greenbaywi.gov/RSSFeed.aspx?CID=Police-Department-Alerts-12&ModID=63"},
]
MAX_BYTES = 100_000


def timestamp(value):
    parsed = parsedate_to_datetime(value)
    if parsed.tzinfo is None:
        raise ValueError("RSS date lacks timezone")
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def compact(value, limit):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", value or ""))).strip()[:limit]


def safe_alert_url(value):
    parsed = urlparse(value or "")
    return value if parsed.scheme == "https" and parsed.hostname == "www.greenbaywi.gov" and parsed.path.lower() == "/alertcenter.aspx" and len(value) <= 1200 else None


def parse_feed(raw, source, now):
    if not raw or len(raw) > MAX_BYTES or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("Green Bay RSS empty, oversized, or contains DTD")
    root = ET.fromstring(raw)
    channel = root.find("channel") if root.tag == "rss" else None
    if channel is None or channel.findtext("title") != source["title"] or channel.findtext("link") != "https://www.greenbaywi.gov/AlertCenter.aspx":
        raise ValueError("Green Bay RSS source identity changed")
    built = timestamp(channel.findtext("lastBuildDate") or "")
    built_at = datetime.fromisoformat(built.replace("Z", "+00:00"))
    if built_at > now + timedelta(hours=2) or now - built_at > timedelta(hours=12):
        raise ValueError("Green Bay RSS build date stale or in future")
    items = channel.findall("item")
    if len(items) > 40:
        raise ValueError("Green Bay RSS item count exceeds limit")
    alerts = []
    seen = set()
    for item in items:
        title = compact(item.findtext("title"), 200)
        detail = compact(item.findtext("description"), 600)
        url = safe_alert_url((item.findtext("link") or "").strip())
        if not title or not url or url in seen:
            raise ValueError("Green Bay RSS item lacks a bounded title or official link")
        seen.add(url)
        raw_date = item.findtext("pubDate")
        published = timestamp(raw_date) if raw_date else None
        if published and datetime.fromisoformat(published.replace("Z", "+00:00")) > now + timedelta(hours=2):
            raise ValueError("Green Bay RSS item date in future")
        alerts.append({"kind": source["kind"], "title": title, "detail": detail, "url": url, "publishedAt": published})
    return {"status": "ok", "kind": source["kind"], "sourceUrl": source["url"], "sourceBuiltAt": built, "publisherTimeAfterCheckMinutes": round((built_at - now).total_seconds() / 60) if built_at > now + timedelta(minutes=5) else None, "activeItemCount": len(alerts), "alerts": alerts}


def fetch(source):
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "20", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-city-alerts", source["url"]]
    response = subprocess.run(command, capture_output=True, timeout=25, check=True)
    body, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
    if not marker:
        raise ValueError("Green Bay RSS response lacks metadata")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
    final = urlparse(effective)
    original = urlparse(source["url"])
    if status != "200" or final.scheme != "https" or final.hostname != original.hostname or final.path != original.path or final.query != original.query:
        raise ValueError(f"Green Bay RSS unexpected response: HTTP {status}")
    return body


def main():
    now = datetime.now(timezone.utc)
    results = []
    for source in SOURCES:
        try:
            results.append(parse_feed(fetch(source), source, now))
        except Exception as error:
            results.append({"status": "failed", "kind": source["kind"], "sourceUrl": source["url"], "sourceBuiltAt": None, "activeItemCount": None, "alerts": [], "error": str(error)[:140]})
    healthy = sum(item["status"] == "ok" for item in results)
    output = {"schema": "event-atlas.green-bay-alerts.v1", "status": "ok" if healthy == 2 else "partial" if healthy else "failed", "builtAt": now.isoformat().replace("+00:00", "Z"), "scope": "City of Green Bay official active Emergency Alerts and Police Department Alerts RSS categories; city scope without incident geometry", "sources": results, "interpretation": "An empty active RSS response means these two checked city website categories listed no items at retrieval. It is not a complete police, emergency, 911, stadium, or protective-intelligence feed, and does not establish an all-clear."}
    out = ROOT / "site/green_bay_alerts.json"
    out.write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Green Bay city alert RSS: {healthy}/2 categories current; {sum(len(item['alerts']) for item in results)} listed items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
