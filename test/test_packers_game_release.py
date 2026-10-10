import importlib.util
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("sync_packers_game_release", Path(__file__).resolve().parents[1] / "scripts/sync_packers_game_release.py")
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)
NOW = datetime(2026, 10, 10, 6, 0, tzinfo=timezone.utc)


def page(headline, body):
    item = {"@type": "NewsArticle", "headline": headline, "datePublished": "2026-10-08T21:45:51Z", "articleBody": body}
    return f'<html><script type="application/ld+json">{json.dumps(item)}</script></html>'.encode()


class PackersReleaseTests(unittest.TestCase):
    def test_article_identity_and_bounded_claim_digest(self):
        body = "Green Bay Packers and Chicago Bears will play at Lambeau Field. " + "Event context. " * 10 + "Fireworks will be set off from the stadium roof one hour prior to kickoff."
        parsed, published = MOD.parse_article(page(MOD.SOURCES["event"][1], body), "event")
        output = MOD.extract_articles({"event": {"body": parsed, "publishedAt": published}}, NOW)
        self.assertEqual(output["status"], "partial")
        self.assertEqual([item["id"] for item in output["claims"]], ["fireworks"])
        self.assertEqual(len(output["claims"][0]["sourceTextSha256"]), 64)
        self.assertEqual(output["claims"][0]["sourceUrl"], MOD.SOURCES["event"][0])

    def test_wrong_article_and_missing_source_fail_closed(self):
        body = "Green Bay Packers and Chicago Bears will play. " + "Event context. " * 10
        with self.assertRaisesRegex(ValueError, "identity"):
            MOD.parse_article(page("Different game", body), "event")
        self.assertEqual(MOD.extract_articles({}, NOW)["status"], "failed")


if __name__ == "__main__":
    unittest.main()
