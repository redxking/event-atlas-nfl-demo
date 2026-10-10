"""Capture bounded Jets–Browns event plans from the official game-day guide."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.newyorkjets.com/fans/gameday-guide-2026"
CLAIMS = [
    ("parking_pass", "access", r"Prior to gameday, parking passes must be printed or added to your mobile wallet before arriving at MetLife Stadium\s*\. Parking hangtags are not available this year", "Jets guide asks drivers to print or add parking passes to a mobile wallet before arriving; it says parking hangtags are unavailable.", []),
    ("entry", "access", r"For expedited entry, it is strongly recommended to enter MetLife Stadium one hour prior to kickoff", "Jets guide recommends entering the stadium one hour before kickoff; this is advice, not a gate opening time.", []),
    ("anthem", "announced_person", r"fan-led National Anthem, led by MarissaAnn Rizzitello", "Jets guide announces MarissaAnn Rizzitello to lead the fan-led national anthem; attendance and performance are unverified.", ["MarissaAnn Rizzitello"]),
    ("tailgate", "production", r"Tailgate Zone, located outside Verizon and MetLife Gates, before kickoff.{0,350}this space opens at 10am", "Jets guide lists the Tailgate Zone outside Verizon and MetLife Gates as opening at 10 a.m. local time; opening is not verified.", []),
    ("giveaway", "promotion", r"gameday giveaway: Green & White Flags courtesy of JetBlue while supplies last", "Jets guide announces a Green & White Flags giveaway courtesy of JetBlue while supplies last.", []),
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
        raise ValueError("Jets guide is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    if not 500 <= len(body) <= 50000 or not re.search(r"Jets face the Browns on October 11 at 1pm", body, re.I) or "MetLife Stadium" not in body:
        raise ValueError("Jets guide no longer identifies the exact game and venue")
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
    return {"schema": "event-atlas.jets-gameday-guide.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872983", "eventDate": "2026-10-11", "venueId": "3839", "sourceUrl": URL, "sourcePublicationTime": None, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-published game plans and recommendations only; no actual gate status, named-person attendance, or event impact is verified."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-guide", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Guide response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.newyorkjets.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected guide response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"Jets guide unavailable: {str(error)[:120]}")
    (ROOT / "site/jets_gameday_guide.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Jets guide: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
