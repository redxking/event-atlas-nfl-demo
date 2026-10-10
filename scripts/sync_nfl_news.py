"""Snapshot bounded NFL publisher RSS and headline API discovery context."""

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
MAX_BYTES = 150_000
API_SOURCE = {"publisher": "ESPN news API", "url": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50"}


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


def parse_api(body, games, now):
    if not body or len(body) > 1_500_000:
        raise ValueError("ESPN news API response exceeds bound")
    data = json.loads(body)
    rows = data.get("articles") if isinstance(data, dict) else None
    if not isinstance(rows, list) or not 1 <= len(rows) <= 100:
        raise ValueError("ESPN news API article array invalid")
    articles = []
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = row.get("headline")
        published = row.get("published")
        links = row.get("links")
        web = links.get("web") if isinstance(links, dict) else None
        url = web.get("href") if isinstance(web, dict) else None
        if not isinstance(title, str) or not title.strip() or len(title) > 300 or not isinstance(published, str) or not isinstance(url, str):
            continue
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != "www.espn.com" or not parsed.path.startswith("/nfl/story/") or url in seen:
            continue
        try:
            at = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if at.tzinfo is None or at > now + timedelta(minutes=5) or now - at > timedelta(days=7):
                continue
        except ValueError:
            continue
        seen.add(url)
        articles.append({"title": title.strip(), "description": "", "url": url, "publishedAt": at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"), "publisher": API_SOURCE["publisher"]})
    if not articles:
        raise ValueError("ESPN news API returned no current NFL story links")
    by_game = {}
    rank = {"matchup_phrase_in_title": 4, "both_teams_in_title": 3, "both_teams_mentioned": 2, "one_team_mentioned": 1}
    for game in games:
        matches = [{**article, "matchBasis": basis} for article in articles if (basis := match_article(game, article, now))]
        if matches:
            by_game[game["id"]] = sorted(matches, key=lambda item: (rank[item["matchBasis"]], item["publishedAt"]), reverse=True)[:8]
    return {"status": "ok", "sourceUrl": API_SOURCE["url"], "publisher": API_SOURCE["publisher"], "sourceBuiltAt": None, "sourceTimeBasis": "retrieval_only", "retrievedAt": now.isoformat().replace("+00:00", "Z"), "articleCount": len(articles), "byGame": by_game, "interpretation": "ESPN API headline metadata is matched by team names. This undocumented public endpoint provides no feed build time; retrieval time is not article publication time. A match is discovery context, not proof of game relevance or attendance."}


def fetch_api():
    source = API_SOURCE
    response = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--max-filesize", "1500000", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-NFL-headline-context", source["url"]], capture_output=True, timeout=30, check=True)
    body, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
    if not marker:
        raise ValueError("ESPN news API response lacks HTTP metadata")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
    final_url = urlparse(effective)
    expected = urlparse(source["url"])
    if status != "200" or final_url.scheme != "https" or final_url.hostname != expected.hostname or final_url.path != expected.path or final_url.query != expected.query:
        raise ValueError("ESPN news API response URL or status changed")
    return body


def main():
    now = datetime.now(timezone.utc)
    games = json.loads((ROOT / "site/nfl.json").read_text())["games"]
    results = []
    for source in SOURCES:
        try:
            results.append(parse_feed(fetch_feed(source), games, now, source))
        except Exception as error:
            results.append({"status": "failed", "publisher": source["publisher"], "sourceUrl": source["url"], "retrievedAt": now.isoformat().replace("+00:00", "Z"), "error": str(error)[:120], "byGame": {}})
    try:
        results.append(parse_api(fetch_api(), games, now))
    except Exception as error:
        results.append({"status": "failed", "publisher": API_SOURCE["publisher"], "sourceUrl": API_SOURCE["url"], "retrievedAt": now.isoformat().replace("+00:00", "Z"), "error": str(error)[:120], "byGame": {}})
    healthy = sum(item["status"] == "ok" for item in results)
    result = {"schema": "event-atlas.nfl-news.v3", "status": "ok" if healthy == len(results) else "partial" if healthy else "failed", "retrievedAt": now.isoformat().replace("+00:00", "Z"), "sources": results, "interpretation": "ESPN and CBS RSS plus ESPN headline API are checked independently. Team-name matches are discovery cues, not confirmation of game relevance, attendance, venue impact, or a threat. Open the linked articles and verify claims."}
    (ROOT / "site/news.json").write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(f"NFL headline feeds: {healthy}/{len(results)} sources current; " + ", ".join(f"{item['publisher']} {item['status']} ({len(item['byGame'])} games)" for item in results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
