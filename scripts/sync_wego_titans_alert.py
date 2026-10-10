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
SERVICE_URL = "https://www.wegotransit.com/titans/"
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


def extract_service(raw, now):
    if not raw or len(raw) > 500_000:
        raise ValueError("Unexpected WeGo Titans-page size")
    page = raw.decode("utf-8", "replace")
    if "WeGo Public Transit" not in page or "2026 Titans Home Games" not in page:
        raise ValueError("WeGo Titans-page identity changed")
    start = page.find("Are you ready for some football?")
    end = page.find("Can't find what you are looking for?", start)
    if start < 0 or end < start:
        raise ValueError("WeGo Titans-page content boundary changed")
    content = re.sub(r"<(?:script|style)\b[^>]*>.*?</(?:script|style)>", " ", page[start:end], flags=re.I | re.S)
    body = clean(content)
    claims = (
        "October 11 vs. Houston Texans",
        "Fares are free on all local bus routes on Titans home game days.",
        "Route 4 – Shelby Route 14 – Whites Creek Route 23 – Dickerson Pike Route 41 – Golden Valley Route 56 – Gallatin Pike",
        "Roundtrip express bus service is available from Cool Springs, Hendersonville, and Gallatin at a cost of $2 each way.",
        "Roundtrip express bus service will also operate from Hickory Hollow and Bellevue at no charge.",
        "Nissan Stadium drop-off and pick-up for all buses is located on Woodland Street and South 1st Street near the Woodland Street bridge.",
        "This special event train begins at Lebanon Station with five additional stops on the way downtown to Riverfront Station.",
        "The return train to Lebanon leaves Riverfront Station one hour after the game ends.",
        "Posted departure times will slide if the game runs long.",
    )
    if any(claim not in body for claim in claims):
        raise ValueError("WeGo Titans service claim missing or changed")
    digest = hashlib.sha256(body.encode()).hexdigest()
    return {"status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": SERVICE_URL, "gameDateText": claims[0], "localRouteNumbers": ["4", "14", "23", "41", "56"], "localFare": "free on Titans home game days", "expressPaidOrigins": ["Cool Springs", "Hendersonville", "Gallatin"], "expressFreeOrigins": ["Hickory Hollow", "Bellevue"], "generalBusBoardingText": claims[5], "trainPlan": "Lebanon to Riverfront with five additional stops; return from Riverfront one hour after the game ends", "sourceTextSha256": digest, "interpretation": "General 2026 Titans service plan, not an exact-game vehicle-position or operational status feed. Exact train departure times are not on this page."}


def fetch_page(url, path):
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 WeGo-public", url]
    result = subprocess.run(command, capture_output=True, timeout=30, check=True)
    raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
    final = urlparse(effective)
    if status != "200" or final.scheme != "https" or final.hostname != "www.wegotransit.com" or final.path != path or final.query:
        raise ValueError("Unexpected WeGo page redirect or status")
    return raw


def main():
    now = datetime.now(timezone.utc)
    try:
        output = extract(fetch_page(URL, "/ride/alerts/"), now)
    except Exception as error:
        output = {"schema": SCHEMA, "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872984", "venueId": "3810", "sourceUrl": URL, "sourceWindowText": None, "startAt": None, "endAt": None, "routeNumbers": [], "summary": None, "sourceTextSha256": None, "interpretation": "Exact-game WeGo notice unavailable or changed; verify current service with the operator."}
        print(f"WeGo Titans alert unavailable: {str(error)[:140]}")
    try:
        output["servicePlan"] = extract_service(fetch_page(SERVICE_URL, "/titans/"), now)
    except Exception as error:
        output["servicePlan"] = {"status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": SERVICE_URL}
        print(f"WeGo Titans service plan unavailable: {str(error)[:140]}")
    (ROOT / "site/wego_titans_alert.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"WeGo Titans alert: {output['status']}; {len(output['routeNumbers'])} routes")


if __name__ == "__main__":
    main()
