"""Snapshot the bounded active-incident index published by NOLA Ready."""

import hashlib
import html
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://ready.nola.gov/incident/"


def extract(raw, now):
    if not raw or len(raw) > 500_000 or b"<html" not in raw[:500].lower():
        raise ValueError("NOLA Ready index is empty, oversized, or not HTML")
    body = raw.decode("utf-8", "replace")
    match = re.search(r"<h2>\s*Active incidents\s*</h2>\s*<ul\b[^>]*class=\"[^\"]*list-button[^\"]*\"[^>]*>(.*?)</ul>", body, re.I | re.S)
    if not match:
        raise ValueError("Active incidents index structure changed")
    section = match.group(1)
    anchors = re.findall(r"<a\b[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", section, re.I | re.S)
    if len(anchors) > 20 or len(re.findall(r"<a\b", section, re.I)) != len(anchors):
        raise ValueError("Active incident links exceeded bound or changed markup")
    entries = []
    for href, label in anchors:
        title = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", label)).split())
        link = urljoin(URL, html.unescape(href))
        parsed = urlparse(link)
        if not 3 <= len(title) <= 180 or parsed.scheme != "https" or parsed.hostname != "ready.nola.gov" or not re.fullmatch(r"/incident/[a-z0-9_-]+/", parsed.path, re.I) or parsed.query or parsed.fragment:
            raise ValueError("Active incident title or link failed validation")
        entries.append({"id": parsed.path.strip("/").split("/")[-1].lower(), "title": title, "url": link})
    if len({item["id"] for item in entries}) != len(entries):
        raise ValueError("Duplicate active incident identity")
    return {"schema": "event-atlas.nola-ready-active.v1", "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "entries": entries, "listSha256": hashlib.sha256(section.encode()).hexdigest(), "interpretation": "City-published active incident index. Entries may be events; listing alone gives no event-time, geometry, incident severity, stadium relevance, or threat determination."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 city-active-index", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("City index response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "ready.nola.gov" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected city index response: HTTP {status}")
        output = extract(raw, datetime.now(timezone.utc))
    except Exception as error:
        output = {"schema": "event-atlas.nola-ready-active.v1", "status": "failed", "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "entries": [], "listSha256": None, "interpretation": "City active-incident index unavailable; no negative finding follows."}
        print(f"NOLA Ready active index unavailable: {str(error)[:120]}")
    (ROOT / "site/nola_ready_active.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"NOLA Ready active index: {output['status']}; {len(output['entries'])} listed")


if __name__ == "__main__":
    main()
