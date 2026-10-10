"""Capture bounded exact-game plans from the official Seahawks game-day guide."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.seahawks.com/game-day/"
CLAIMS = [
    ("sounder_trains", "transit_plan", r"Sounder Game Trains will be running this game with service to Lumen Field", "Seahawks guide announces Sounder game trains for this game; a train run or capacity is not verified.", []),
    ("tailgate_open", "operations", r"Ticketmaster Tailgate Opens 10:00 a\.m\.", "Seahawks guide lists Ticketmaster Tailgate opening at 10:00 a.m. local time; actual opening is unverified.", []),
    ("gates_open", "operations", r"All Gates Open 11:30 a\.m\.", "Seahawks guide lists all gates opening at 11:30 a.m. local time; actual gate status is unverified.", []),
    ("anthem", "announced_person", r"National Anthem Mateo Lopez Mateo Adalberto Lopez", "Seahawks guide announces Mateo Lopez for the national anthem; attendance and performance are unverified.", ["Mateo Lopez"]),
    ("halftime", "announced_person", r"Crucial Catch Bell Ceremony featuring Allen Stone In honor of our Crucial Catch game.{0,270}special performance from singer Allen Stone", "Seahawks guide announces Allen Stone for the halftime Crucial Catch bell ceremony honoring cancer survivors; attendance and execution are unverified.", ["Allen Stone"]),
    ("flyover", "aviation", r"flyover featuring a C-17 Globemaster III from the 446th Operations Group at Joint Base Lewis McChord\. Pending weather", "Seahawks guide announces a weather-dependent C-17 Globemaster III flyover from the 446th Operations Group; flight is unverified.", []),
    ("giveaway", "promotion", r"All fans in attendance will receive a mini 12 flag", "Seahawks guide announces a mini 12 flag giveaway; availability and distribution are unverified.", []),
]


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1
        if tag == "img" and not self.hidden:
            alt = dict(attrs).get("alt")
            if alt:
                self.parts.append(alt)

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def parse_page(raw):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Seahawks guide is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    if not 500 <= len(body) <= 75000 or not re.search(r"WEEK 5\s*[•|]\s*SUN 10/11\s*[•|]\s*1:25 PM PDT", body, re.I) or "San Francisco 49ers" not in body or "Lumen Field" not in body:
        raise ValueError("Seahawks guide no longer identifies the exact game and venue")
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
    return {"schema": "event-atlas.seahawks-gameday.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872992", "eventDate": "2026-10-11", "venueId": "3673", "sourceUrl": URL, "sourcePublicationTime": None, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-published plans only; train runs, gate status, named-person attendance, ceremony execution, aircraft flight, and current NOTAM terms are unverified."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-guide", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Guide response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.seahawks.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected guide response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"Seahawks guide unavailable: {str(error)[:120]}")
    (ROOT / "site/seahawks_gameday.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Seahawks guide: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
