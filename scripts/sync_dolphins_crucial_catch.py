"""Capture bounded claims from the Dolphins' exact-game Crucial Catch announcement."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.miamidolphins.com/news/dolphins-cancer-challenge-celebrates-100-million-lifetime-raised-at-crucial-catch-game"
HEADLINE = "Dolphins Cancer Challenge Celebrates $100 Million Lifetime Raised at Crucial Catch Game"
CLAIMS = [
    ("crucial_catch_theme", "production", r"activations on Sunday, Oct\. 11 against the Cincinnati Bengals", "Dolphins announce a Crucial Catch game program against Cincinnati on Oct. 11; execution is unverified.", []),
    ("fan_zone_mural", "operations", r"pre-game activities will give fans the opportunity to contribute to a community mural in the Dolphins Fan Zone", "Dolphins announce a pregame Fan Zone community mural; timing and execution are unverified.", []),
    ("survivor_recognition", "production", r"28 members of the [‘']Believe In You[’'] program.{0,160}?recognized during the game", "Dolphins announce a group of 28 cancer survivors for game recognition; individual identities and attendance are unverified.", []),
    ("halftime_recognition", "production", r"Cancer fighters and survivors will join DCC board members and Sylvester doctors and researchers on the field at halftime", "Dolphins announce a halftime DCC recognition; participants and execution are unverified.", []),
    ("nimer_game_ball", "announced_person", r"Dr\. Stephen Nimer, Director of Sylvester Comprehensive Cancer Center, will also be gifted a game ball", "Dolphins announce Dr. Stephen Nimer as a game-ball honoree; attendance is unverified.", ["Stephen Nimer"]),
    ("almeida_recognition", "announced_person", r"Nicole Almeida, corporate affairs manager at AutoNation, will be recognized as the Truist Local Legend", "Dolphins announce Nicole Almeida as a Truist Local Legend honoree; attendance is unverified.", ["Nicole Almeida"]),
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

    def handle_data(self, value):
        if self.active:
            self.items.append(value)


def parse_article(raw):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Dolphins article is empty, oversized, or not HTML")
    parser = JsonLd()
    parser.feed(raw.decode("utf-8", "replace"))
    articles = []
    for value in parser.items:
        parsed = json.loads(value)
        articles.extend(parsed if isinstance(parsed, list) else [parsed])
    article = next((item for item in articles if isinstance(item, dict) and item.get("@type") == "NewsArticle"), None)
    if not article or article.get("headline") != HEADLINE or not str(article.get("datePublished", "")).startswith("2026-10-07"):
        raise ValueError("Dolphins article identity or publication date changed")
    body = article.get("articleBody")
    if not isinstance(body, str) or not 500 <= len(body) <= 10000 or "Hard Rock Stadium" not in body or "Cincinnati Bengals" not in body:
        raise ValueError("Dolphins article body is invalid or not tied to the exact game")
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
    return {"schema": "event-atlas.dolphins-crucial-catch.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872982", "eventDate": "2026-10-11", "venueId": "3948", "sourceUrl": URL, "publishedAt": published_at, "claims": claims, "missingClaimIds": missing, "interpretation": "Club-announced program and honorees only; execution, individual attendance, protective status, and threat are unverified."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-announcement", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Article response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.miamidolphins.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected article response: HTTP {status}")
        body, published = parse_article(raw)
        output = extract(body, published, datetime.now(timezone.utc))
    except Exception as error:
        output = extract("", None, datetime.now(timezone.utc))
        print(f"Dolphins announcement unavailable: {str(error)[:120]}")
    (ROOT / "site/dolphins_crucial_catch.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Dolphins announcement: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == "__main__":
    main()
