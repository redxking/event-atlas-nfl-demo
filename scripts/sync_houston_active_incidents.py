"""Publish only aggregate counts from Houston's public active-incidents page."""

import json
import ssl
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


SOURCE = "https://cohweb.houstontx.gov/ActiveIncidents/Combined.aspx"
OUTPUT = Path("site/houston_active_incidents.json")
SCHEMA = "event-atlas.houston-active-incidents-count.v1"


class IncidentTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.cells = []
        self.rows = []
        self.text = ""
        self.table_count = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table" and ("id", "GridView2") in attrs:
            self.in_table = True
            self.table_count += 1
        elif self.in_table and tag == "tr":
            self.in_row = True
            self.cells = []
        elif self.in_row and tag in ("td", "th"):
            self.in_cell = True
            self.text = ""

    def handle_data(self, data):
        if self.in_cell:
            self.text += data

    def handle_endtag(self, tag):
        if self.in_cell and tag in ("td", "th"):
            self.cells.append(" ".join(self.text.split()))
            self.in_cell = False
        elif self.in_row and tag == "tr":
            self.rows.append(self.cells)
            self.in_row = False
        elif self.in_table and tag == "table":
            self.in_table = False


def parse_counts(html):
    parser = IncidentTable()
    parser.feed(html)
    expected = ["Agency", "Address", "Cross Street", "Key Map", "Call Time(Opened)", "Incident Type", "Combined Response"]
    if parser.table_count != 1 or not parser.rows or parser.rows[0] != expected or len(parser.rows) > 1001:
        raise ValueError("Houston active-incident table missing or changed")
    counts = {"FD": 0, "PD": 0}
    for row in parser.rows[1:]:
        if len(row) != 7 or row[0] not in counts or not row[4] or not row[5]:
            raise ValueError("Houston active-incident row unexpected")
        counts[row[0]] += 1
    return {"fireEmsCount": counts["FD"], "policeCount": counts["PD"], "totalCount": sum(counts.values())}


def fetch_counts(now=None):
    now = now or datetime.now(timezone.utc)
    request = Request(SOURCE, headers={"Accept": "text/html", "Cache-Control": "no-cache", "User-Agent": "EventAtlas/0.4 public citywide aggregate"})
    try:
        import certifi
        tls = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        tls = ssl.create_default_context()
    with urlopen(request, timeout=15, context=tls) as response:
        if response.url != SOURCE or response.status != 200:
            raise ValueError("Houston active-incident response redirected or unavailable")
        if "text/html" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("Houston active-incident content type unexpected")
        source_http_at = parsedate_to_datetime(response.headers["Date"])
        if abs((now - source_http_at).total_seconds()) > 300:
            raise ValueError("Houston active-incident HTTP response date is stale")
        html = response.read(750001)
        if len(html) > 750000:
            raise ValueError("Houston active-incident response too large")
    counts = parse_counts(html.decode("utf-8", errors="replace"))
    return {"schema": SCHEMA, "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceHttpAt": source_http_at.isoformat().replace("+00:00", "Z"), "scope": "Houston Fire/EMS and Police active incidents citywide", **counts, "sourceUrl": SOURCE, "interpretation": "Citywide count of rows on the official active-incident page at retrieval. No addresses, incident types, call times, IDs, or people are retained. Not a stadium-area count, venue alert, trend, or threat finding."}


if __name__ == "__main__":
    try:
        result = fetch_counts()
    except Exception as error:
        result = {"schema": SCHEMA, "status": "failed", "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "sourceHttpAt": None, "scope": "Houston Fire/EMS and Police active incidents citywide", "fireEmsCount": None, "policeCount": None, "totalCount": None, "sourceUrl": SOURCE, "error": str(error)[:180]}
    OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(f"Houston citywide active incidents: {result['status']}" + (f"; {result['totalCount']} listed" if result["status"] == "ok" else ""))
