"""Capture bounded plans for the exact Titans–Texans game from the host club."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.tennesseetitans.com/stadium/gameday/"
CLAIMS = [
    ("parking_open", "operations", r"Parking Lots Open:\s*8 AM", "Titans list parking lots opening at 8 a.m. Central; actual opening is unverified."),
    ("ticket_office", "operations", r"Gate 1 Ticket Office Opens:\s*9 AM", "Titans list the Gate 1 ticket office opening at 9 a.m. Central; actual opening is unverified."),
    ("tailgate_open", "operations", r"Pinnacle Titan Up Tailgate:\s*10 AM", "Titans list the Pinnacle Titan Up Tailgate at 10 a.m. Central; actual operation is unverified."),
    ("gates_open", "operations", r"Stadium Gates Open:\s*10 AM", "Titans list stadium gates opening at 10 a.m. Central; actual gate status is unverified."),
    ("alcohol_end", "operations", r"Alcohol Sales End:\s*End of 3rd Quarter", "Titans list alcohol sales ending at the end of the third quarter; actual service is unverified."),
    ("parking_close", "operations", r"Parking Lots Close:\s*2 Hours After Game", "Titans list parking lots closing two hours after the game; this is a relative published plan, not a verified closure time."),
]


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def parse_page(raw):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Titans guide is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    if not 500 <= len(body) <= 75000 or not re.search(r"WEEK 5\s*[•|]\s*SUN 10/11\s*[•|]\s*12:00 PM CDT", body, re.I) or not re.search(r"Week 5 vs\. TEXANS\s*\|\s*Oct\. 11, 2026", body, re.I) or "Nissan Stadium" not in body:
        raise ValueError("Titans guide no longer identifies the exact game and venue")
    return body


def extract(body, now):
    claims = []
    missing = []
    for claim_id, category, pattern, summary in CLAIMS:
        match = re.search(pattern, body, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": category, "summary": summary, "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {"schema": "event-atlas.titans-gameday.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872984", "eventDate": "2026-10-11", "venueId": "3810", "sourceUrl": URL, "sourcePublicationTime": None, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-published operating plans only; parking, ticket office, tailgate, gate and alcohol-service status are unverified. Confirm with the club and responsible operators."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-guide", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Guide response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.tennesseetitans.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected guide response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"Titans guide unavailable: {str(error)[:120]}")
    (ROOT / "site/titans_gameday.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Titans guide: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
