"""Snapshot attributable NFL publisher RSS headlines as team news context."""

import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    {"publisher": "ESPN", "url": "https://www.espn.com/espn/rss/nfl/news", "hosts": {"www.espn.com", "espn.com"}, "articlePrefix": "/nfl/", "description": True},
    {"publisher": "CBS Sports", "url": "https://www.cbssports.com/rss/headlines/nfl/", "hosts": {"www.cbssports.com", "cbssports.com"}, "articlePrefix": "/nfl/", "description": False},
]
FEED = SOURCES[0]["url"]
MAX_BYTES = 150_000


def iso(value):
    parsed = parsedate_to_datetime(value)
    if parsed.tzinfo is None:
        raise ValueError("RSS timestamp lacks a timezone")
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def team_nicknames(game):
    teams = game["title"].split(" at ")
    if len(teams) != 2:
        return None
    return [team.split()[-1] for team in teams]


def match_article(game, article, now):
    teams = team_nicknames(game)
    if not teams:
        return None
    kickoff = datetime.fromisoformat(game["kickoff"].replace("Z", "+00:00"))
    published = datetime.fromisoformat(article["publishedAt"].replace("Z", "+00:00"))
    if abs(kickoff - now) > timedelta(days=8) or not now - timedelta(days=7) <= published <= now + timedelta(hours=2):
        return None
    if not kickoff - timedelta(days=7) <= published <= kickoff + timedelta(days=2):
        return None
    title = article["title"]
    text = title + " " + article["description"]
    word = lambda team: r"(?<![\w])" + re.escape(team) + r"(?![\w])"
    title_hits = [team for team in teams if re.search(word(team), title, re.I)]
    if len(title_hits) == 2:
        bridge = r".{0,100}?(?:\bvs\.?|\bat\b|@|[-–—]).{0,30}?"
        if any(re.search(word(a) + bridge + word(b), title, re.I) for a, b in (teams, teams[::-1])):
            return "matchup_phrase_in_title"
        return "both_teams_in_title"
    hits = [team for team in teams if re.search(word(team), text, re.I)]
    return "both_teams_mentioned" if len(hits) == 2 else "one_team_mentioned" if hits else None


def parse_feed(xml, games, now, source=SOURCES[0]):
    if len(xml) > MAX_BYTES or b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
        raise ValueError("NFL RSS exceeds the size limit or contains a DTD")
    root = ET.fromstring(xml)
    if root.tag != "rss":
        raise ValueError("Expected RSS root")
    channel = root.find("channel")
    if channel is None:
        raise ValueError("Missing RSS channel")
    built = iso(channel.findtext("lastBuildDate") or "")
    built_at = datetime.fromisoformat(built.replace("Z", "+00:00"))
    if built_at > now + timedelta(hours=2) or now - built_at > timedelta(hours=12):
        raise ValueError("NFL RSS publisher build date is stale or in the future")
    items = channel.findall("item")
    if not 1 <= len(items) <= 100:
        raise ValueError("Unexpected NFL RSS item count")
    articles = []
    seen = set()
    for item in items:
        title = (item.findtext("title") or "").strip()[:300]
        description = (item.findtext("description") or "").strip()[:500] if source["description"] else ""
        link = (item.findtext("link") or "").strip()
        parsed = urlparse(link)
        if not title or parsed.scheme != "https" or parsed.hostname not in source["hosts"] or not parsed.path.startswith(source["articlePrefix"]) or link in seen:
            continue
        try:
            published = iso(item.findtext("pubDate") or "")
        except (ValueError, TypeError):
            continue
        seen.add(link)
        articles.append({"title": title, "description": description, "url": link, "publishedAt": published, "publisher": source["publisher"]})
    if len(articles) < 5:
        raise ValueError(f"Too few valid {source['publisher']} NFL articles")
    by_game = {}
    for game in games:
        matches = []
        for article in articles:
            match = match_article(game, article, now)
            if match:
                matches.append({**article, "matchBasis": match})
        if matches:
            rank = {"matchup_phrase_in_title": 4, "both_teams_in_title": 3, "both_teams_mentioned": 2, "one_team_mentioned": 1}
            by_game[game["id"]] = sorted(matches, key=lambda item: (rank[item["matchBasis"]], item["publishedAt"]), reverse=True)[:8]
    return {"status": "ok", "sourceUrl": source["url"], "publisher": source["publisher"], "sourceBuiltAt": built, "retrievedAt": now.isoformat().replace("+00:00", "Z"), "articleCount": len(articles), "byGame": by_game, "interpretation": "Publisher RSS titles and available feed descriptions are classified by explicit matchup phrases and team-name mentions. A title phrase is a discovery cue, not verification of this event's details, attendance, venue impact, or a threat. Open the publisher article for details."}


def fetch_feed(source=SOURCES[0]):
    response = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "3", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-NFL-news-context", source["url"]], capture_output=True, timeout=30, check=True)
    body, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
    if not marker:
        raise ValueError(f"{source['publisher']} RSS response lacks HTTP metadata")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
    final_url = urlparse(effective)
    expected = urlparse(source["url"])
    if status != "200" or final_url.scheme != "https" or final_url.hostname not in source["hosts"] or final_url.path != expected.path:
        raise ValueError(f"{source['publisher']} RSS unexpected response: HTTP {status}, host {final_url.hostname}, path {final_url.path}")
    if not body:
        raise ValueError(f"{source['publisher']} RSS returned an empty HTTP 200 response")
    return body


def main():
    now = datetime.now(timezone.utc)
    games = json.loads((ROOT / "site/nfl.json").read_text())["games"]
    failures = []
    result = None
    for source in SOURCES:
        try:
            result = parse_feed(fetch_feed(source), games, now, source)
            break
        except Exception as error:
            failures.append(f"{source['publisher']}: {str(error)[:120]}")
    if result is None:
        result = {"status": "failed", "sourceUrl": FEED, "publisher": None, "retrievedAt": now.isoformat().replace("+00:00", "Z"), "error": "; ".join(failures)[:300], "byGame": {}}
    (ROOT / "site/news.json").write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(f"NFL RSS {result['publisher'] or 'unavailable'}: {result['status']}; {len(result['byGame'])} games with team mentions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
