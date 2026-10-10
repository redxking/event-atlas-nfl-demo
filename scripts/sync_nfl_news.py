"""Snapshot ESPN's public NFL RSS headlines as attributable team news context."""

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
FEED = "https://www.espn.com/espn/rss/nfl/news"
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
    text = article["title"] + " " + article["description"]
    hits = [team for team in teams if re.search(r"(?<![\w])" + re.escape(team) + r"(?![\w])", text, re.I)]
    return "both_teams_mentioned" if len(hits) == 2 else "one_team_mentioned" if hits else None


def parse_feed(xml, games, now):
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
        description = (item.findtext("description") or "").strip()[:500]
        link = (item.findtext("link") or "").strip()
        parsed = urlparse(link)
        if not title or parsed.scheme != "https" or parsed.hostname not in {"www.espn.com", "espn.com"} or not parsed.path.startswith("/nfl/") or link in seen:
            continue
        try:
            published = iso(item.findtext("pubDate") or "")
        except (ValueError, TypeError):
            continue
        seen.add(link)
        articles.append({"title": title, "description": description, "url": link, "publishedAt": published, "publisher": "ESPN"})
    if len(articles) < 5:
        raise ValueError("Too few valid ESPN NFL articles")
    by_game = {}
    for game in games:
        matches = []
        for article in articles:
            match = match_article(game, article, now)
            if match:
                matches.append({**article, "matchBasis": match})
        if matches:
            by_game[game["id"]] = sorted(matches, key=lambda item: item["publishedAt"], reverse=True)[:8]
    return {"status": "ok", "sourceUrl": FEED, "publisher": "ESPN", "sourceBuiltAt": built, "retrievedAt": now.isoformat().replace("+00:00", "Z"), "articleCount": len(articles), "byGame": by_game, "interpretation": "Publisher RSS headlines and descriptions matched by team-name mentions. A mention does not establish relevance to this specific game, attendance, venue impact, or a threat. Open ESPN for the full article."}


def main():
    now = datetime.now(timezone.utc)
    games = json.loads((ROOT / "site/nfl.json").read_text())["games"]
    try:
        response = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--max-time", "25", "--header", "User-Agent: EventAtlas/0.4 public-NFL-news-context", FEED], capture_output=True, timeout=30, check=True)
        xml = response.stdout
        result = parse_feed(xml, games, now)
    except Exception as error:
        result = {"status": "failed", "sourceUrl": FEED, "publisher": "ESPN", "retrievedAt": now.isoformat().replace("+00:00", "Z"), "error": str(error)[:200], "byGame": {}}
    (ROOT / "site/news.json").write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(f"ESPN NFL RSS: {result['status']}; {len(result['byGame'])} games with team mentions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
