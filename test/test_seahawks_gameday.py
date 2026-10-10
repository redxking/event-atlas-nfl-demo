import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_seahawks_gameday.py"
spec = importlib.util.spec_from_file_location("seahawks_guide", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SeahawksGuideTests(unittest.TestCase):
    def test_extract_keeps_exact_plan_claims(self):
        body = ' '.join([
            'Sounder Game Trains will be running this game with service to Lumen Field.',
            'Ticketmaster Tailgate Opens 10:00 a.m. All Gates Open 11:30 a.m.',
            'National Anthem Mateo Lopez Mateo Adalberto Lopez.',
            'Crucial Catch Bell Ceremony featuring Allen Stone In honor of our Crucial Catch game, survivors ring the bell with a special performance from singer Allen Stone.',
            'flyover featuring a C-17 Globemaster III from the 446th Operations Group at Joint Base Lewis McChord. Pending weather.',
            'All fans in attendance will receive a mini 12 flag.',
        ])
        result = module.extract(body, datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["claims"]), 7)
        self.assertEqual(result["claims"][3]["names"], ["Mateo Lopez"])
        self.assertIsNone(result["sourcePublicationTime"])

    def test_partial_when_flyover_passage_does_not_match(self):
        result = module.extract("Sounder Game Trains will be running this game with service to Lumen Field", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "partial")
        self.assertIn("flyover", result["missingClaimIds"])


if __name__ == "__main__":
    unittest.main()
