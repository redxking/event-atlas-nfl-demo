import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts/sync_jets_gameday_guide.py"
spec = importlib.util.spec_from_file_location("jets_guide", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class JetsGuideTests(unittest.TestCase):
    def test_extract_requires_bounded_source_passages(self):
        body = ' '.join([
            'Prior to gameday, parking passes must be printed or added to your mobile wallet before arriving at MetLife Stadium. Parking hangtags are not available this year.',
            'For expedited entry, it is strongly recommended to enter MetLife Stadium one hour prior to kickoff.',
            'fan-led National Anthem, led by MarissaAnn Rizzitello.',
            'Tailgate Zone, located outside Verizon and MetLife Gates, before kickoff! This space opens at 10am!',
            'gameday giveaway: Green & White Flags courtesy of JetBlue while supplies last.',
        ])
        result = module.extract(body, datetime.now(timezone.utc))
        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(result["claims"]), 5)
        self.assertEqual(result["claims"][2]["names"], ["MarissaAnn Rizzitello"])
        self.assertIsNone(result["sourcePublicationTime"])

    def test_missing_claim_is_partial(self):
        result = module.extract("fan-led National Anthem, led by MarissaAnn Rizzitello", datetime.now(timezone.utc))
        self.assertEqual(result["status"], "partial")
        self.assertEqual(len(result["missingClaimIds"]), 4)


if __name__ == "__main__":
    unittest.main()
