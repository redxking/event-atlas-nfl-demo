"""Capture bounded club-published plans for Chargers at Chiefs on October 18."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.chiefs.com/game-day/2026/reg-week6/chargers-at-chiefs/"
CLAIMS = [
    ("parking_open", r"PARKING LOTS\s+Gates will open 4\.5 hours prior to scheduled kick-off", "Parking gates are listed to open 4.5 hours before scheduled kickoff.", -270),
    ("open_park", r"OPEN PARK\s+First 30 minutes after parking gates open", "The club lists an Open Park period for the first 30 minutes after parking gates open.", None),
    ("tailgate_suites", r"TAILGATE SUITES\s+Open with parking gates; Close at kick-off", "Tailgate Suites are listed to open with parking gates and close at kickoff.", -270),
    ("ford_tailgate", r"FORD TAILGATE DISTRICT\s+Opens 30 minutes after parking gates, Closes at kick-off", "Ford Tailgate District is listed to open 30 minutes after parking gates and close at kickoff.", -240),
    ("club_level", r"COMMUNITYAMERICA CLUB LEVEL\s+Opens 2\.5 hours prior to kick-off", "CommunityAmerica Club Level is listed to open 2.5 hours before kickoff.", -150),
    ("stadium_gates", r"STADIUM GATES\s+Open 2 hours prior to kick-off", "Stadium gates are listed to open two hours before kickoff.", -120),
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
    if not raw or len(raw) > 750_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Chiefs game center is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    if not 500 <= len(body) <= 75_000:
        raise ValueError("Chiefs game center visible text is invalid")
    if not re.search(r"WEEK 6\s*[•|]\s*SUN\s*[•|]\s*10/18", body, re.I):
        raise ValueError("Chiefs game center no longer identifies the exact date")
    if not all(label in body for label in ("Los Angeles Chargers", "Kansas City Chiefs", "Arrowhead Stadium")):
        raise ValueError("Chiefs game center no longer identifies the exact matchup and venue")
    return body


def extract(body, now):
    claims, missing = [], []
    for claim_id, pattern, summary, offset in CLAIMS:
        match = re.search(pattern, body, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": "club_operating_plan", "summary": summary,
                       "openingOffsetMinutes": offset, "sourceUrl": URL,
                       "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {"schema": "event-atlas.chiefs-game-center.v1", "status": "ok" if not missing else "partial" if claims else "failed",
            "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401873006",
            "eventDate": "2026-10-18", "venueId": "3622", "sourceUrl": URL,
            "sourcePublicationTime": None, "claims": claims, "missingClaimIds": missing,
            "interpretation": "Club-published plans for the listed game, not observed gate, parking, tailgate, or crowd conditions. Confirm any operational decision with the club."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2",
               "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out",
               "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-center", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Game center response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.chiefs.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected Chiefs game center response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"Chiefs game center unavailable: {str(error)[:120]}")
    (ROOT / "site/chiefs_game_center.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Chiefs game center: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded plans checked")


if __name__ == "__main__":
    main()
