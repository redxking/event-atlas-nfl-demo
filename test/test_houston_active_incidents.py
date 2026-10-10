import unittest

from scripts.sync_houston_active_incidents import parse_counts


class HoustonActiveIncidentsTest(unittest.TestCase):
    def test_counts_only_and_rejects_changed_table(self):
        header = "".join(f"<th>{name}</th>" for name in ("Agency", "Address", "Cross Street", "Key Map", "Call Time(Opened)", "Incident Type", "Combined Response"))
        def row(agency, address):
            return f"<tr><td>{agency}</td><td>{address}</td><td>cross street</td><td>map</td><td>10/10/2026 08:00</td><td>EMS EVENT</td><td>N</td></tr>"
        html = f'<table id="GridView2"><tr>{header}</tr>{row("FD", "private address")}{row("PD", "another address")}</table>'
        self.assertEqual(parse_counts(html), {"fireEmsCount": 1, "policeCount": 1, "totalCount": 2})
        self.assertNotIn("address", str(parse_counts(html)))
        with self.assertRaisesRegex(ValueError, "unexpected"):
            parse_counts(html.replace("<td>PD</td>", "<td>OTHER</td>"))
        with self.assertRaisesRegex(ValueError, "missing or changed"):
            parse_counts(html.replace("Incident Type", "Type"))


if __name__ == "__main__":
    unittest.main()
