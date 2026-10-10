"""Capture WeGo's dated Nissan Stadium service notice for the Titans game."""

import hashlib
import html
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.wegotransit.com/ride/alerts/"
SCHEMA = "event-atlas.wego-titans-alert.v1"
ROUTES = ("14", "23", "41", "56")
WINDOW = "Sun October 11, 2026 10:00 AM-Sun October 11, 2026 4:00 PM"
DETAIL = "Routes 14, 23, 41, and 56 will travel using Woodland St to S 5th St inbound and outbound from 10 a.m. until 4 p.m. Nissan Stadium Stop is Woodland & S 1st. No Service on N 1st or S 1st Street."
ROUTE_BLOCK = re.compile(r'<div\s+id="CT_Main_1_rptRoutes_ctl\d+_divRoute"[^>]*RouteNumber="(\d+)"', re.I)
ITEM = re.compile(r'<li\s+class="alert-item"[^>]*>(.*?)</li>', re.I | re.S)


def clean(value):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def extract(raw, now):
    if not raw or len(raw) > 500_000:
        raise ValueError("Unexpected WeGo alert-page size")
    page = raw.decode("utf-8", "replace")
    if "WeGo" not in page or "alerts-accordion" not in page:
        raise ValueError("WeGo alert-page identity changed")
    blocks = list(ROUTE_BLOCK.finditer(page))
    if not 1 <= len(blocks) <= 250:
        raise ValueError("Unexpected WeGo route section count")
    matches = {}
    for index, block in enumerate(blocks):
        route = block[1]
        if route not in ROUTES:
            continue
        body = page[block.end():blocks[index + 1].start() if index + 1 < len(blocks) else len(page)]
        notices = [clean(item[1]) for item in ITEM.finditer(body)]
        exact = [notice for notice in notices if WINDOW in notice and DETAIL in notice]
        if exact:
            matches[route] = exact[0]
    if tuple(sorted(matches, key=int)) != tuple(sorted(ROUTES, key=int)) or len(set(matches.values())) != 1:
        raise ValueError("Exact-game Nissan Stadium notice is missing or differs across routes")
    normalized = next(iter(matches.values()))
    return {"schema": SCHEMA, "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872984", "venueId": "3810", "sourceUrl": URL, "sourceWindowText": WINDOW, "startAt": "2026-10-11T15:00:00Z", "endAt": "2026-10-11T21:00:00Z", "routeNumbers": list(ROUTES), "summary": DETAIL, "sourceTextSha256": hashlib.sha256(normalized.encode()).hexdigest(), "interpretation": "Operator-published October 11 service change for four routes at the Nissan Stadium stop. A dated notice does not verify vehicle movement, actual stop service, crowd effect or a threat."}


def main():
    now = datetime.now(timezone.utc)
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 WeGo-alerts", URL]
    try:
        result = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.wegotransit.com" or final.path != "/ride/alerts/" or final.query:
            raise ValueError("Unexpected WeGo alert-page redirect or status")
        output = extract(raw, now)
    except Exception as error:
        output = {"schema": SCHEMA, "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872984", "venueId": "3810", "sourceUrl": URL, "sourceWindowText": None, "startAt": None, "endAt": None, "routeNumbers": [], "summary": None, "sourceTextSha256": None, "interpretation": "Exact-game WeGo notice unavailable or changed; verify current service with the operator."}
        print(f"WeGo Titans alert unavailable: {str(error)[:140]}")
    (ROOT / "site/wego_titans_alert.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"WeGo Titans alert: {output['status']}; {len(output['routeNumbers'])} routes")


if __name__ == "__main__":
    main()
