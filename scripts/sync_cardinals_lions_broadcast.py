"""Capture bounded exact-game information from the Cardinals' official article."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.azcardinals.com/news/how-to-watch-cardinals-vs-lions-week-5"
HEADLINE = "How To Watch: Cardinals vs. Lions, Week 5"
CLAIMS = [
    ("event_listing", r"The Arizona Cardinals take on the Detroit Lions at State Farm Stadium on Sunday, October 11 at 1:25 p\.m\. MST", "The Cardinals list the Lions game at State Farm Stadium for October 11 at 1:25 p.m. Arizona time; confirm kickoff with the NFL and club."),
    ("tv_assignment", r"WATCH ON TV\s+FOX\s+Kevin Kugler \(play-by-play\), Daryl Johnston \(analyst\) and Allison Williams \(sideline\)", "The club lists FOX and Kevin Kugler, Daryl Johnston, and Allison Williams in broadcast roles; their physical attendance is unverified."),
    ("radio_assignment", r"LISTEN LIVE ON CARDINALS RADIO\s+Arizona Sports 98\.7 FM\s+\*?\s*J\.P\. Shadrick \(play-by-play\), A\.Q\. Shipley \(analyst\) and Dani Sureck \(sideline\)", "The club lists Arizona Sports 98.7 FM and J.P. Shadrick, A.Q. Shipley, and Dani Sureck in radio roles; their physical attendance is unverified."),
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
        raise ValueError("Cardinals article is empty, oversized, or not HTML")
    parser = JsonLd()
    parser.feed(raw.decode("utf-8", "replace"))
    articles = []
    for value in parser.items:
        parsed = json.loads(value)
        articles.extend(parsed if isinstance(parsed, list) else [parsed])
    article = next((item for item in articles if isinstance(item, dict) and item.get("@type") == "NewsArticle"), None)
    if not article or article.get("headline") != HEADLINE or not str(article.get("datePublished", "")).startswith("2026-10-07"):
        raise ValueError("Cardinals article identity or publication date changed")
    body = article.get("articleBody")
    if not isinstance(body, str) or not 500 <= len(body) <= 10000 or "Detroit Lions" not in body or "State Farm Stadium" not in body:
        raise ValueError("Cardinals article body is invalid or not exact-game related")
    return " ".join(body.split()), article["datePublished"]


def extract(body, published_at, now):
    claims = []
    missing = []
    for claim_id, pattern, summary in CLAIMS:
        match = re.search(pattern, body, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": "official_event_context", "summary": summary, "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {"schema": "event-atlas.cardinals-lions-broadcast.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872991", "eventDate": "2026-10-11", "venueId": "3970", "sourceUrl": URL, "publishedAt": published_at, "claims": claims, "missingClaimIds": missing, "interpretation": "Official exact-game listing and announced broadcast assignments. Names are professional role claims, not verified on-site attendance, protective status, or threat intelligence."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-context", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Article response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.azcardinals.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected article response: HTTP {status}")
        body, published = parse_article(raw)
        output = extract(body, published, datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", None, datetime.now(timezone.utc))
        print(f"Cardinals article unavailable: {str(error)[:120]}")
    (ROOT / "site/cardinals_lions_broadcast.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Cardinals exact-game context: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} claims checked")


if __name__ == "__main__":
    main()
