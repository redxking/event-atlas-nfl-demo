"""Extract bounded exact-game context from the Steelers' official article."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.steelers.com/news/steelers-vs-colts-how-to-watch-listen-to-the-game-x5006"
HEADLINE = "Steelers vs Colts: How to watch/listen to the game"
CLAIMS = [
    ("event_listing", r"Steelers take on the Colts from Acrisure Stadium in Pittsburgh, Pennsylvania", "The Steelers list the Colts matchup at Acrisure Stadium in Pittsburgh; confirm the current kickoff with the NFL and club."),
    ("tv_assignment", r"game broadcast is carried on CBS \(KDKA-TV locally in Pittsburgh\).*?Sunday at 1:00 p\.m\. ET.*?Jim Nantz \(play-by-play\), J\.J\. Watt \(analyst\), and Tracy Wolfson \(field reporter\) are on the game call", "The club lists CBS coverage at 1:00 p.m. ET and Jim Nantz, J.J. Watt, and Tracy Wolfson in television broadcast roles; their physical attendance is unverified."),
    ("pregame_assignment", r"BetMGM Steelers Kickoff pregame show with Bob Pompeani and former Steelers quarterback Charlie Batch airs at 11:30 a\.m\. ET on KDKA-TV", "The club lists a Pittsburgh-market pregame show at 11:30 a.m. ET with Bob Pompeani and Charlie Batch; this is a broadcast plan, not verified on-site attendance."),
    ("radio_assignment", r"Steelers Audio Network - Game coverage begins at 1:00 p\.m\. ET; Pregame programming begins at 11:00 a\.m\..*?Rob King \(play-by-play\), Max Starks \(color analyst\) & Missi Matthews \(sideline reporter\) are on the game call", "The club lists Steelers Audio Network programming and Rob King, Max Starks, and Missi Matthews in radio roles; physical attendance is unverified."),
]


class JsonLd(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.items = []

    def handle_starttag(self, tag, attrs):
        self.active = tag == "script" and dict(attrs).get("type") == "application/ld+json"

    def handle_endtag(self, tag):
        if tag == "script":
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.items.append(data)


def parse_article(raw):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Steelers article is empty, oversized, or not HTML")
    parser = JsonLd()
    parser.feed(raw.decode("utf-8", "replace"))
    articles = []
    for value in parser.items:
        parsed = json.loads(value)
        articles.extend(parsed if isinstance(parsed, list) else [parsed])
    article = next((item for item in articles if isinstance(item, dict) and item.get("@type") == "NewsArticle"), None)
    if not article or article.get("headline") != HEADLINE or not str(article.get("datePublished", "")).startswith("2026-10-06"):
        raise ValueError("Steelers article identity or publication date changed")
    body = article.get("articleBody")
    if not isinstance(body, str) or not 1000 <= len(body) <= 15000 or "Steelers take on the Colts" not in body or "Acrisure Stadium" not in body:
        raise ValueError("Steelers article body is invalid or not exact-game related")
    return " ".join(body.split()), article["datePublished"]


def extract(body, published_at, now):
    claims = []
    missing = []
    for claim_id, pattern, summary in CLAIMS:
        match = re.search(pattern, body, re.I | re.S)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": "official_event_context", "summary": summary, "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {"schema": "event-atlas.steelers-colts-broadcast.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872985", "eventDate": "2026-10-11", "venueId": "3752", "sourceUrl": URL, "publishedAt": published_at, "claims": claims, "missingClaimIds": missing, "interpretation": "Official exact-game listing and announced broadcast assignments. Names are professional role claims, not verified on-site attendance, protective status, or threat intelligence."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-context", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Article response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.steelers.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected article response: HTTP {status}")
        body, published = parse_article(raw)
        output = extract(body, published, datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", None, datetime.now(timezone.utc))
        print(f"Steelers article unavailable: {str(error)[:120]}")
    (ROOT / "site/steelers_colts_broadcast.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Steelers exact-game context: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} claims checked")


if __name__ == "__main__":
    main()
