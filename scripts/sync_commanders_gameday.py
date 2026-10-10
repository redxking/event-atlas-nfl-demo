"""Capture bounded, exact-game claims from the Commanders' official Giants guide."""
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.commanders.com/matchups/giants"
CLAIMS = [
    ("rideshare_open", "operations", r"8:00 AM: Rideshare lots open", "Commanders list rideshare lots opening at 8 a.m. ET; actual opening is unverified.", []),
    ("parking_open", "operations", r"9:00 AM: Parking lots opens", "Commanders list parking lots opening at 9 a.m. ET; actual opening is unverified.", []),
    ("plaza_open", "operations", r"10:00 AM: Legends Plaza opens", "Commanders list Legends Plaza opening at 10 a.m. ET; actual opening is unverified.", []),
    ("gates_open", "operations", r"11:00 AM: Stadium gates opens", "Commanders list stadium gates opening at 11 a.m. ET; actual opening is unverified.", []),
    ("plaza_band", "program", r"Legends Plaza: Michelle Blackwell Band", "Commanders announce the Michelle Blackwell Band at Legends Plaza; performance is unverified.", []),
    ("color_guard", "program", r"Color Guard: United States Navy", "Commanders announce a U.S. Navy color guard; participation is unverified.", []),
    ("anthem", "announced_person", r"Anthem: Generald Wilson", "Commanders announce Generald Wilson for the anthem; appearance is unverified.", ["Generald Wilson"]),
    ("halftime", "program", r"Halftime: Crucial Catch Tribute", "Commanders announce a Crucial Catch halftime tribute; execution is unverified.", []),
    ("legend", "announced_person", r"Legend of the Game: Taylor Heinicke", "Commanders announce Taylor Heinicke as Legend of the Game; appearance is unverified.", ["Taylor Heinicke"]),
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
        raise ValueError("Commanders guide is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    identity = re.search(r"Week 5\s+vs\. Giants\s+.*?Sunday, October 11\s+.*?1:00 PM\s+.*?HOME: Northwest Stadium", body, re.I)
    if not 500 <= len(body) <= 75_000 or not identity or "Gameday Entertainment" not in body:
        raise ValueError("Commanders guide no longer identifies the exact game and venue")
    return body


def extract(body, now):
    claims, missing = [], []
    section = body.split("Gameday Entertainment", 1)[1].split("Fan Code of Conduct", 1)[0] if "Gameday Entertainment" in body else ""
    for claim_id, category, pattern, summary, names in CLAIMS:
        match = re.search(pattern, section, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": category, "summary": summary, "names": names, "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {"schema": "event-atlas.commanders-gameday.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872988", "eventDate": "2026-10-11", "venueId": "3719", "sourceUrl": URL, "sourcePublicationTime": None, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-published plans and named appearances only. Times are eastern; opening, activity execution, and attendance are unverified."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-guide", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Guide response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.commanders.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected guide response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"Commanders guide unavailable: {str(error)[:120]}")
    (ROOT / "site/commanders_gameday.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Commanders guide: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
