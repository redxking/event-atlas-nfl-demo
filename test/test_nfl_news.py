import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("sync_nfl_news", Path(__file__).resolve().parents[1] / "scripts/sync_nfl_news.py")
NEWS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NEWS)
NOW = datetime(2026, 10, 9, 23, 50, tzinfo=timezone.utc)
GAME = {"id": "nfl:1", "title": "Chicago Bears at Green Bay Packers", "kickoff": "2026-10-11T17:00Z"}


def feed(headline="Bears and Packers prepare for Sunday"):
    items = "".join(f"<item><title>{headline if index == 0 else 'League notes'}</title><description>{'Bears and Packers' if index == 0 else 'General NFL news'}</description><link>https://www.espn.com/nfl/story/_/id/{index+1}/example</link><pubDate>Fri, 9 Oct 2026 18:30:00 GMT</pubDate></item>" for index in range(5))
    return f"<rss><channel><lastBuildDate>Fri, 9 Oct 2026 23:45:00 GMT</lastBuildDate>{items}</channel></rss>".encode()


class NflNewsTests(unittest.TestCase):
    def test_source_link_and_team_mention_are_bounded(self):
        result = NEWS.parse_feed(feed(), [GAME], NOW)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["byGame"]["nfl:1"][0]["matchBasis"], "both_teams_in_title")
        self.assertEqual(result["articleCount"], 5)
        self.assertEqual(len(result["byGame"]["nfl:1"]), 1)

    def test_team_mention_does_not_become_game_confirmation(self):
        article = {"title": "Bears roster update", "description": "", "publishedAt": "2026-10-09T18:30:00Z"}
        self.assertEqual(NEWS.match_article(GAME, article, NOW), "one_team_mentioned")
        self.assertIsNone(NEWS.match_article({**GAME, "kickoff": "2026-12-01T17:00Z"}, article, NOW))

    def test_matchup_title_and_description_tiers(self):
        article = {"publishedAt": "2026-10-09T18:30:00Z", "description": ""}
        self.assertEqual(NEWS.match_article(GAME, {**article, "title": "Bears RB out, QB questionable vs. Packers"}, NOW), "matchup_phrase_in_title")
        self.assertEqual(NEWS.match_article(GAME, {**article, "title": "Bears, Packers announce roster moves"}, NOW), "both_teams_in_title")
        self.assertEqual(NEWS.match_article(GAME, {**article, "title": "Bears roster update", "description": "Packers also play this week"}, NOW), "both_teams_mentioned")

    def test_matchup_title_ranks_ahead_of_newer_team_mentions(self):
        xml = feed("Bears RB out vs. Packers").replace(b"League notes", b"Bears roster update")
        result = NEWS.parse_feed(xml, [GAME], NOW)
        self.assertEqual(result["byGame"]["nfl:1"][0]["matchBasis"], "matchup_phrase_in_title")

    def test_cbs_fallback_keeps_headline_link_and_omits_description(self):
        source = NEWS.SOURCES[1]
        cbs = feed().replace(b"www.espn.com/nfl/story/_/id/", b"www.cbssports.com/nfl/news/")
        result = NEWS.parse_feed(cbs, [GAME], NOW, source)
        self.assertEqual(result["publisher"], "CBS Sports")
        self.assertEqual(result["byGame"]["nfl:1"][0]["description"], "")
        self.assertTrue(result["byGame"]["nfl:1"][0]["url"].startswith("https://www.cbssports.com/nfl/"))

    def test_rejects_dtd_and_stale_feed(self):
        with self.assertRaisesRegex(ValueError, "DTD"):
            NEWS.parse_feed(b"<!DOCTYPE rss>" + feed(), [GAME], NOW)
        with self.assertRaisesRegex(ValueError, "stale"):
            NEWS.parse_feed(feed().replace(b"9 Oct 2026 23:45", b"8 Oct 2026 08:45"), [GAME], NOW)


if __name__ == "__main__":
    unittest.main()
