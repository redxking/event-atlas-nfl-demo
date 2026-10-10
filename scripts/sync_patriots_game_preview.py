"""Capture a few exact-game announcements from the official Patriots preview."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.patriots.com/news/game-preview-patriots-vs-raiders-nfl-week-5"
HEADLINE = "Game Preview: Patriots vs. Raiders | NFL Week 5"
CLAIMS = [
    ("throwback_uniforms", "production", r'The Patriots will wear red jerseys with white pants and a white helmet featuring the "Pat Patriot" logo with white facemasks', "The Patriots announce red throwback jerseys, white pants, and Pat Patriot helmets for this game.", []),
    ("championship_team", "ceremony", r"The 2001 team will be honored in a special pregame ceremony", "The Patriots announce a pregame recognition of members of the 2001 championship team; individual attendance is unverified.", []),
    ("vinatieri_halftime", "announced_person", r"Adam Vinatieri, who will receive his Pro Football Hall of Fame Ring of Excellence during halftime of this week.s game against the Las Vegas Raiders", "The Patriots announce Adam Vinatieri as the halftime Ring of Excellence honoree; his attendance is unverified.", ["Adam Vinatieri"]),
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
        raise ValueError("Patriots article is empty, oversized, or not HTML")
    parser = JsonLd()
    parser.feed(raw.decode("utf-8", "replace"))
    articles = []
    for value in parser.items:
        parsed = json.loads(value)
        articles.extend(parsed if isinstance(parsed, list) else [parsed])
    article = next((item for item in articles if isinstance(item, dict) and item.get("@type") == "NewsArticle"), None)
    if not article or article.get("headline") != HEADLINE or not str(article.get("datePublished", "")).startswith("2026-10-07"):
        raise ValueError("Patriots article identity or publication date changed")
    body = article.get("articleBody")
    if not isinstance(body, str) or not 100 <= len(body) <= 30000 or "Las Vegas Raiders" not in body or "Gillette Stadium" not in body:
        raise ValueError("Patriots article body is invalid or not exact-game related")
    return " ".join(body.split()), article["datePublished"]


def extract(body, published_at, now):
    claims = []
    missing = []
    for claim_id, category, pattern, summary, names in CLAIMS:
        match = re.search(pattern, body, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": category, "summary": summary, "names": names, "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {"schema": "event-atlas.patriots-game-preview.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872986", "eventDate": "2026-10-11", "venueId": "3738", "sourceUrl": URL, "publishedAt": published_at, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-announced plans and honorees only; no attendance, execution, protective status, or threat is verified."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-preview", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Article response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.patriots.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected article response: HTTP {status}")
        body, published = parse_article(raw)
        output = extract(body, published, datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", None, datetime.now(timezone.utc))
        print(f"Patriots preview unavailable: {str(error)[:120]}")
    (ROOT / "site/patriots_game_preview.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Patriots preview: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
