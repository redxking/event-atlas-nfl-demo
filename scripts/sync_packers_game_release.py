"""Capture bounded, event-specific claims from two official Packers articles."""

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
GAME_ID = "nfl:401872990"
SOURCES = {
    "event": ("https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026", "Lambeau Field ready for Packers-Bears game Sunday"),
    "alumni": ("https://www.packers.com/news/packers-welcoming-bubba-franks-ryan-longwell-as-featured-alumni-this-week-oct-8-2026", "Packers welcoming Bubba Franks, Ryan Longwell as featured alumni this week"),
}
CLAIMS = [
    ("parking", "event", "operations", r"The Lambeau Field parking lots will open Sunday at 8 a\.m\., with stadium gates opening at 10 a\.m\..{0,140}Atrium will be open to ticket holders at 8 a\.m\.", "Packers list parking lots opening at 8 a.m., stadium gates at 10 a.m., and ticket-holder Atrium access at 8 a.m. local time.", []),
    ("fireworks", "event", "production", r"Fireworks will be set off from the stadium roof one hour prior to kickoff", "Packers announce a stadium-roof fireworks cue one hour before the listed kickoff.", []),
    ("flyover", "event", "aviation", r"A flyover is scheduled to be performed by four F-35 aircraft from the 115th Fighter Wing", "Packers announce a planned four-aircraft F-35 flyover by the 115th Fighter Wing.", []),
    ("anthem", "event", "ceremony", r"The University of Wisconsin Marching Band will perform the national anthem", "Packers announce the University of Wisconsin Marching Band for the national anthem.", []),
    ("recognition", "event", "announced_person", r"the Packers will recognize U\.S\. Navy Chief Kera Archambeault through Operation Fan Mail", "Packers announce a pre-anthem Operation Fan Mail recognition of U.S. Navy Chief Kera Archambeault.", ["Kera Archambeault"]),
    ("featured_alumni", "alumni", "announced_people", r"welcoming back featured alumni Ryan Longwell and Bubba Franks for the Packers-Bears game on Sunday, Oct\. 11", "Packers name Ryan Longwell and Bubba Franks as featured alumni for the Oct. 11 game; this does not verify their attendance.", ["Ryan Longwell", "Bubba Franks"]),
    ("franks_gameday", "alumni", "announced_person", r"On gameday Franks will be visiting with fans from 10:25 a\.m\. to 11:25 a\.m\. in the Legends Club", "Packers announce a game-day fan appearance by Bubba Franks at the Legends Club, 10:25–11:25 a.m. local time.", ["Bubba Franks"]),
    ("ruettgers_gameday", "alumni", "announced_person", r"Ken Ruettgers will sign autographs and greet fans at the Chevrolet display on the Fan Walkway.{0,80}from 9 to 11 a\.m\.", "Packers announce a game-day fan appearance by Ken Ruettgers on the Fan Walkway, 9–11 a.m. local time.", ["Ken Ruettgers"]),
    ("titletown_alumni", "alumni", "announced_people", r"Sean Jones and Daryn Colledge will be at Titletown for Titletown Gameday Live.{0,230}from 10 to 11 a\.m\.", "Packers announce game-day Q&A appearances by Sean Jones and Daryn Colledge at Titletown, 10–11 a.m. local time.", ["Sean Jones", "Daryn Colledge"]),
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


def parse_article(raw, source_id):
    if not raw or len(raw) > 1_000_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Packers article is empty, oversized, or not HTML")
    parser = JsonLd()
    parser.feed(raw.decode("utf-8", "replace"))
    articles = []
    for value in parser.items:
        parsed = json.loads(value)
        articles.extend(parsed if isinstance(parsed, list) else [parsed])
    article = next((item for item in articles if isinstance(item, dict) and item.get("@type") == "NewsArticle"), None)
    if not article or article.get("headline") != SOURCES[source_id][1] or not str(article.get("datePublished", "")).startswith("2026-10-08"):
        raise ValueError("Packers article identity or publication date changed")
    body = article.get("articleBody")
    identity = isinstance(body, str) and ("Packers-Bears" in body if source_id == "alumni" else "Green Bay Packers and Chicago Bears" in body)
    if not isinstance(body, str) or len(body) < 100 or len(body) > 20000 or not identity:
        raise ValueError("Packers article body is invalid or not event-specific")
    return " ".join(body.split()), article["datePublished"]


def extract_articles(articles, now):
    claims = []
    missing = []
    for claim_id, source_id, category, pattern, summary, names in CLAIMS:
        body = articles.get(source_id, {}).get("body", "")
        match = re.search(pattern, body, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({"id": claim_id, "category": category, "summary": summary, "names": names, "sourceUrl": SOURCES[source_id][0], "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    checks = [{"id": source_id, "sourceUrl": url, "state": "checked" if source_id in articles else "failed", "publishedAt": articles.get(source_id, {}).get("publishedAt")} for source_id, (url, _) in SOURCES.items()]
    return {"schema": "event-atlas.packers-game-release.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": GAME_ID, "eventDate": "2026-10-11", "venueId": "3798", "sources": checks, "claims": claims, "missingClaimIds": missing, "interpretation": "These are publisher-announced plans and appearances, not observations that a person attended, an activity occurred, or a security condition was met. Confirm current operations and any corrections with the club."}


def fetch_article(source_id):
    url = SOURCES[source_id][0]
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 official-game-release", url]
    response = subprocess.run(command, capture_output=True, timeout=30, check=True)
    body, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
    if not marker:
        raise ValueError("Packers article response lacks metadata")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
    final = urlparse(effective)
    if status != "200" or final.scheme != "https" or final.hostname != "www.packers.com" or final.path != urlparse(url).path:
        raise ValueError(f"Packers article unexpected response: HTTP {status}")
    return body


def main():
    now = datetime.now(timezone.utc)
    articles = {}
    for source_id in SOURCES:
        try:
            body, published = parse_article(fetch_article(source_id), source_id)
            articles[source_id] = {"body": body, "publishedAt": published}
        except Exception as error:
            print(f"{source_id}: {str(error)[:120]}", file=sys.stderr)
    output = extract_articles(articles, now)
    (ROOT / "site/packers_game_release.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Packers game release: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
