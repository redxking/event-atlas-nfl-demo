"""Capture bounded venue-published Packers home-game operating plans."""

import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://www.packers.com/lambeau-field/gameday-information"
CLAIMS = [
    ("gates", "Gate entry", r"All stadium gates open two hours prior to kickoff", "The venue lists stadium gates opening two hours before kickoff."),
    ("oneida", "Pregame traffic", r"Oneida St will be closed for vehicular traffic from Lombardi Ave to Mike McCarthy Way.{0,100}from 4 hours prior to kick-off until 2 hours after the conclusion of the game", "The venue lists a planned Oneida Street vehicle closure between Lombardi Avenue and Mike McCarthy Way beginning four hours before kickoff and ending two hours after the game concludes."),
    ("lombardi", "During-game traffic", r"Lombardi Ave will be closed from Ridge Rd to Oneida St\. at kick-off", "The venue lists a planned Lombardi Avenue closure between Ridge Road and Oneida Street beginning at kickoff."),
    ("postgame", "Postgame traffic", r"Mike McCarthy Way.{0,100}will become one way eastbound from Oneida St to Ashland Ave.{0,180}Oneida St will become one way northbound.{0,180}Ridge Rd will become one way northbound", "The venue lists postgame one-way traffic on Mike McCarthy Way, Oneida Street, and Ridge Road; verify actual traffic control before routing."),
    ("bus", "Game day bus", r"four free, efficient and convenient gameday bus routes.{0,220}routes begin four hours before kickoff.{0,240}leaving Lambeau Field every 30 minutes", "The venue lists four free game day bus routes starting four hours before kickoff, with departures from Lambeau Field every 30 minutes; confirm the current route and after-game service plan."),
    ("rideshare", "Rideshare pickup", r"Your driver will meet you at the corner of Mike McCarthy Way and Holmgren Way", "The venue lists the Mike McCarthy Way and Holmgren Way corner as the game day rideshare meeting point."),
]


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def parse_page(raw, now):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Packers page is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    visible = " ".join(" ".join(parser.parts).split())
    if "Lambeau Field" not in visible or "Traffic Flow" not in visible or "Gate Entry" not in visible:
        raise ValueError("Packers page identity or key sections changed")
    claims = []
    missing = []
    for claim_id, topic, pattern, summary in CLAIMS:
        match = re.search(pattern, visible, re.I)
        if not match:
            missing.append(claim_id)
            continue
        fingerprint = hashlib.sha256(match.group(0).encode()).hexdigest()
        claims.append({"id": claim_id, "topic": topic, "summary": summary, "sourceUrl": SOURCE, "sourceTextSha256": fingerprint})
    return {"schema": "event-atlas.lambeau-gameday.v1", "status": "ok" if not missing else "partial", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": SOURCE, "scope": "Green Bay Packers public home-game venue plan; general published plan, not a per-game live operations check", "claims": claims, "missingClaimIds": missing, "interpretation": "Published venue instructions can inform event access planning. Source text has no supplied revision time. A planned closure, route, or gate time is not observed implementation or a verified incident; confirm current conditions with the venue and responsible agencies."}


def fetch_page():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-venue-operations", SOURCE]
    response = subprocess.run(command, capture_output=True, timeout=30, check=True)
    body, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
    if not marker:
        raise ValueError("Packers page response lacks metadata")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
    final = urlparse(effective)
    if status != "200" or final.scheme != "https" or final.hostname != "www.packers.com" or final.path != "/lambeau-field/gameday-information":
        raise ValueError(f"Packers page unexpected response: HTTP {status}")
    return body


def main():
    now = datetime.now(timezone.utc)
    try:
        output = parse_page(fetch_page(), now)
    except Exception as error:
        output = {"schema": "event-atlas.lambeau-gameday.v1", "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": SOURCE, "claims": [], "missingClaimIds": [item[0] for item in CLAIMS], "error": str(error)[:160]}
    (ROOT / "site/lambeau_gameday.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Lambeau venue plan: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
