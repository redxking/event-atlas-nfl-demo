"""Capture bounded Lakefront festival context from the official NOLA Ready notice."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from sync_falcons_gameday import VisibleText

ROOT = Path(__file__).resolve().parents[1]
URL = "https://ready.nola.gov/incident/the-city-of-new-orleans-has-granted-permits-to-fes/national-fried-chicken-festival-2026/"
CLAIMS = [
    ("sunday_window", r"Sunday, Oct\. 11\s*,?\s*11:00 a\.m\. to 9:00 p\.m\.", "City lists the festival on Sunday, Oct. 11, from 11 a.m. to 9 p.m. local time."),
    ("lakefront_location", r"Lakefront and Gentilly, including the area around the UNO Lakefront Arena, Franklin Avenue, and Leon C\. Simon Drive", "City places the festival in the Lakefront and Gentilly area near UNO Lakefront Arena, Franklin Avenue and Leon C. Simon Drive."),
    ("traffic_advisory", r"Expect traffic delays and heavy pedestrian traffic during the event\. The New Orleans Police Department will provide traffic control at Franklin Avenue and Leon C\. Simon Drive", "City advises of local delays and pedestrians, with NOPD traffic control planned at Franklin Avenue and Leon C. Simon Drive."),
]


def parse_page(raw):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("NOLA Ready regional notice is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    if not 800 <= len(body) <= 75000 or "National Fried Chicken Festival 2026 - NOLA Ready" not in body or "Fri Oct 09 2026 8:34 AM" not in body:
        raise ValueError("NOLA Ready regional notice identity or publication text changed")
    return body


def extract(body, now):
    claims, missing = [], []
    for claim_id, pattern, summary in CLAIMS:
        match = re.search(pattern, body, re.I)
        if match:
            claims.append({"id": claim_id, "summary": summary, "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
        else:
            missing.append(claim_id)
    return {"schema": "event-atlas.nola-ready-regional.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872987", "venueId": "3493", "eventDate": "2026-10-11", "sourceUrl": URL, "sourcePublicationText": "Fri Oct 09 2026 8:34 AM" if body else None, "claims": claims, "missingClaimIds": missing, "interpretation": "Official city festival notice for Lakefront/Gentilly. Published hours overlap the Saints game, but stadium travel, staffing and security effects are not established."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 city-regional-event", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("City regional notice response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "ready.nola.gov" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected city regional response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"NOLA Ready regional notice unavailable: {str(error)[:120]}")
    (ROOT / "site/nola_ready_regional.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"NOLA Ready regional event: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
