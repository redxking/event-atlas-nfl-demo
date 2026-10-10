"""Capture bounded exact-game statements from the official Saints guide."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from sync_falcons_gameday import VisibleText

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.neworleanssaints.com/news/saints-vs-vikings-2026-nfl-week-5-gameday-guide"
CLAIMS = [
    ("champions_square", "operations", r"Champions Square will be open for pre-game festivities three hours prior to kick off for ticketed guests and conclude 45 minutes before kick off", "Saints plan Champions Square festivities from three hours to 45 minutes before kickoff for ticketed guests; actual opening and closing are unverified.", []),
    ("stage_performance", "production", r"Stage Performance: Big Sam's Funky Nation", "Saints announce Big Sam's Funky Nation for the Champions Square stage; performance is unverified.", []),
    ("anthem", "announced_person", r"National Anthem: Robin Barnes", "Saints announce Robin Barnes for the national anthem; appearance is unverified.", ["Robin Barnes"]),
    ("ring_of_honor", "announced_person", r"Drew Brees Ring of Honor Presentation In our Meta Halftime ceremony, former Saints QB Drew Brees.{0,250}?during halftime", "Saints announce a Drew Brees Ring of Honor and Hall of Fame Ring of Excellence presentation at halftime; ceremony and attendance are unverified.", ["Drew Brees"]),
    ("legend_of_game", "announced_person", r"Legend of the Game: Joe Horn", "Saints name Joe Horn Legend of the Game; appearance is unverified.", ["Joe Horn"]),
]


def parse_page(raw):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Saints guide is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    if not 500 <= len(body) <= 75000 or not re.search(r"Saints vs\. Vikings \| 2026 NFL Week 5 \| Gameday Guide", body, re.I) or not re.search(r"host the Minnesota Vikings.{0,100}Caesars Superdome", body, re.I) or "Oct 09, 2026 at 10:01 AM" not in body:
        raise ValueError("Saints guide no longer identifies the exact game, venue, and publication text")
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
    return {"schema": "event-atlas.saints-gameday.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872987", "eventDate": "2026-10-11", "venueId": "3493", "sourceUrl": URL, "sourcePublicationText": "Oct 09, 2026 at 10:01 AM" if body else None, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-published plans and named appearances only. Actual operations, ceremonies and person attendance are unverified."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-guide", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Guide response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.neworleanssaints.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected guide response: HTTP {status}")
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", datetime.now(timezone.utc))
        print(f"Saints guide unavailable: {str(error)[:120]}")
    (ROOT / "site/saints_gameday.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Saints guide: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
