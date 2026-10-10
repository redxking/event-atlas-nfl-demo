"""Capture dated Nashville OEM release headlines as citywide source context."""

import html
import json
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.nashville.gov/departments/emergency-management/news"
SCHEMA = "event-atlas.nashville-oem-news.v1"
ITEM = re.compile(
    r'<a\s+href="(?P<path>/departments/emergency-management/news/[a-z0-9-]+)"[^>]*class="[^"]*news-link--desktop[^"]*"[^>]*>'
    r'(?P<body>.*?)</a>', re.I | re.S
)
TITLE = re.compile(r'<div\s+class="news--title"[^>]*>(.*?)</div>', re.I | re.S)
DATE = re.compile(r'<time\s+datetime="([^"]+)"', re.I)


def extract(raw, now):
    if not raw or len(raw) > 500_000:
        raise ValueError("Unexpected Nashville OEM page size")
    page = raw.decode("utf-8", "replace")
    if "news-link--desktop" not in page or "news--title" not in page:
        raise ValueError("Nashville OEM news listing markers absent")
    entries = []
    seen = set()
    for match in ITEM.finditer(page):
        title_match = TITLE.search(match["body"])
        date_match = DATE.search(match["body"])
        if not title_match or not date_match:
            raise ValueError("Nashville OEM release missing title or date")
        title = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", title_match[1])).split())
        published = datetime.fromisoformat(date_match[1].replace("Z", "+00:00"))
        path = match["path"]
        if not 3 <= len(title) <= 180 or published.tzinfo is None or path in seen or published > now + timedelta(minutes=5):
            raise ValueError("Invalid or duplicate Nashville OEM release")
        seen.add(path)
        entries.append({"title": title, "publishedAt": published.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"), "url": "https://www.nashville.gov" + path})
    if not 1 <= len(entries) <= 100:
        raise ValueError("Unexpected Nashville OEM release count")
    entries.sort(key=lambda item: item["publishedAt"], reverse=True)
    return {"schema": SCHEMA, "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "lastPublishedAt": entries[0]["publishedAt"], "recent": [item for item in entries if datetime.fromisoformat(item["publishedAt"].replace("Z", "+00:00")) >= now - timedelta(days=7)][:20], "interpretation": "Dated citywide OEM release headlines, not a live emergency-alert or incident feed. Open each release to verify current status, location and relevance."}


def main():
    now = datetime.now(timezone.utc)
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 Nashville-OEM-news", URL]
    try:
        result = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.nashville.gov" or final.path != "/departments/emergency-management/news" or final.query:
            raise ValueError("Unexpected Nashville OEM news redirect or status")
        output = extract(raw, now)
    except Exception as error:
        output = {"schema": SCHEMA, "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "lastPublishedAt": None, "recent": [], "interpretation": "OEM newsroom unavailable; no negative finding follows."}
        print(f"Nashville OEM newsroom unavailable: {str(error)[:120]}")
    (ROOT / "site/nashville_oem_news.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Nashville OEM newsroom: {output['status']}; {len(output['recent'])} recent")


if __name__ == "__main__":
    main()
