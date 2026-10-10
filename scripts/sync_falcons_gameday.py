"""Capture bounded, exact-game plans from the official Falcons game-day page."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.atlantafalcons.com/tickets/gameday"
CLAIMS = [
    ("roof_plan", "operations", r"ROOF STATUS Open \(Pending Weather\)", "Falcons list the roof as planned open, pending weather; actual roof status is unverified.", []),
    ("parking_open", "operations", r"Parking Lots Open 3:50 p\.m\.", "Falcons list parking opening at 3:50 p.m. EDT; actual opening is unverified.", []),
    ("gates_open", "operations", r"Gates Open 6:50 p\.m\.", "Falcons list gates opening at 6:50 p.m. EDT; actual opening is unverified.", []),
    ("tailgate", "operations", r"Dirty Birds Nest Prime-Time Tailgate and March.{0,600}?7:00 p\.m\.", "Falcons publish a Dirty Birds Nest tailgate and march before kickoff; timing and execution should be checked with the club.", []),
    ("tailgate_legends", "announced_people", r"Dirty Birds Nest Tailgate: 6:00 p\.m\. - 7:00 p\.m\. - Tevin Coleman and Eric Weems", "Falcons announce Tevin Coleman and Eric Weems for the Dirty Birds Nest meet and greet, 6–7 p.m.; appearance is unverified.", ["Tevin Coleman", "Eric Weems"]),
    ("backyard_legends", "announced_people", r"Home Depot Backyard\s*: 6:45 p\.m\. - 7:45 p\.m\. - Michael Jenkins and Mohamed Sanu", "Falcons announce Michael Jenkins and Mohamed Sanu for the Home Depot Backyard meet and greet, 6:45–7:45 p.m.; appearance is unverified.", ["Michael Jenkins", "Mohamed Sanu"]),
    ("front_porch_legend", "announced_person", r"Front Porch: 6:45 p\.m\. [–-] 8:00 pm\. - Jessie Tuggle", "Falcons announce Jessie Tuggle for the Front Porch meet and greet, 6:45–8 p.m.; appearance is unverified.", ["Jessie Tuggle"]),
    ("skybridge_legend", "announced_person", r"300-Level Skybridge\s*: 6:45 p\.m\. - 8:00 p\.m\. - Mike Kenn", "Falcons announce Mike Kenn for the 300-Level Skybridge meet and greet, 6:45–8 p.m.; appearance is unverified.", ["Mike Kenn"]),
    ("ring_of_honor", "announced_person", r"Falcons will induct John Abraham into the Ring of Honor during the game on Sunday, October 11", "Falcons announce John Abraham's Ring of Honor induction during the Oct. 11 game; ceremony and attendance are unverified.", ["John Abraham"]),
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
        raise ValueError("Falcons guide is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    if not 500 <= len(body) <= 75000 or not re.search(r"WEEK 5\s*•\s*SUN 10/11\s*•\s*8:20 PM EDT", body, re.I) or not re.search(r"Ravens Baltimore Ravens.{0,100}Falcons Atlanta Falcons", body, re.I) or "Mercedes-Benz Stadium" not in body:
        raise ValueError("Falcons guide no longer identifies the exact game and venue")
    return body


def extract(body, now):
    claims = []
    missing = []
    for claim_id, category, pattern, summary, names in CLAIMS:
        match = re.search(pattern, body, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": category, "summary": summary, "names": names, "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {"schema": "event-atlas.falcons-gameday.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872993", "eventDate": "2026-10-11", "venueId": "5348", "sourceUrl": URL, "sourcePublicationTime": None, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-published plans and named appearances only. Roof, parking, gates, ceremonies and appearances are unverified; appearances are subject to change."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-guide", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Guide response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.atlantafalcons.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected guide response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"Falcons guide unavailable: {str(error)[:120]}")
    (ROOT / "site/falcons_gameday.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Falcons guide: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
