"""Read bounded public AZ511 alert listings without using the keyed API."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://az511.gov/List/Alerts"
SCHEMA = "event-atlas.az511-public-alerts.v1"
ARIZONA = timezone(timedelta(hours=-7))


class AlertTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_body = False
        self.in_row = False
        self.in_cell = False
        self.cell = []
        self.row = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div" and attrs.get("id") == "AlertsPage":
            self.in_table = True
        elif self.in_table and tag == "tbody":
            self.in_body = True
        elif self.in_body and tag == "tr":
            self.in_row, self.row = True, []
        elif self.in_row and tag == "td":
            self.in_cell, self.cell = True, []
        elif self.in_cell and tag in ("p", "li", "br"):
            self.cell.append(" ")

    def handle_endtag(self, tag):
        if tag == "td" and self.in_cell:
            self.row.append(" ".join("".join(self.cell).split()))
            self.in_cell = False
        elif tag == "tr" and self.in_row:
            self.rows.append(self.row)
            self.in_row = False
        elif tag == "tbody":
            self.in_body = False

    def handle_data(self, data):
        if self.in_cell:
            self.cell.append(data)


def alert_dates(notes, local_year):
    pattern = r"\b(?:Friday|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})\s*-\s*(?:Friday|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})\b"
    match = re.search(pattern, notes, re.I)
    if not match:
        return None, None
    first = datetime.strptime(f"{match[1].title()} {match[2]} {local_year}", "%b %d %Y").date()
    second_year = local_year + (match[3].lower() == "jan" and match[1].lower() == "dec")
    last = datetime.strptime(f"{match[3].title()} {match[4]} {second_year}", "%b %d %Y").date()
    if not first <= last <= first + timedelta(days=14):
        return None, None
    return first.isoformat(), last.isoformat()


def extract(raw, now):
    if not raw or len(raw) > 1_000_000 or b"AlertsPage" not in raw:
        raise ValueError("AZ511 public alerts page missing or oversized")
    parser = AlertTable()
    parser.feed(raw.decode("utf-8", "replace"))
    if len(parser.rows) > 50:
        raise ValueError("AZ511 alert row count exceeded bound")
    entries = []
    for row in parser.rows:
        if len(row) != 3:
            raise ValueError("AZ511 alert row has unexpected fields")
        title, notes, updated = row
        if not 3 <= len(title) <= 180 or not 10 <= len(notes) <= 2000 or len(updated) > 60:
            raise ValueError("AZ511 alert content invalid")
        local = datetime.strptime(updated, "%b %d %Y, %I:%M %p").replace(tzinfo=ARIZONA)
        at = local.astimezone(timezone.utc)
        if at > now + timedelta(minutes=5):
            raise ValueError("AZ511 alert update is in the future")
        start, end = alert_dates(notes, local.year)
        entries.append({"title": title, "notes": notes, "updatedAt": at.isoformat().replace("+00:00", "Z"), "localDateStart": start, "localDateEnd": end, "sourceTextSha256": hashlib.sha256((title + "\n" + notes).encode()).hexdigest(), "sourceUrl": URL})
    entries.sort(key=lambda item: item["updatedAt"], reverse=True)
    return {"schema": SCHEMA, "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "entries": entries[:20], "interpretation": "Public AZ511 alert listings with publisher update times. A dated regional notice is not a geocoded event, observed closure, stadium route impact, or live police alert."}


def main():
    now = datetime.now(timezone.utc)
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-alert-list", URL]
    try:
        result = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname not in ("az511.gov", "www.az511.gov") or final.path != "/List/Alerts":
            raise ValueError("Unexpected AZ511 alert page response")
        output = extract(raw, now)
    except Exception as error:
        output = {"schema": SCHEMA, "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "entries": [], "interpretation": "AZ511 public alerts page unavailable; no negative finding follows."}
        print(f"AZ511 public alerts unavailable: {str(error)[:120]}")
    (ROOT / "site/az511_public_alerts.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"AZ511 public alerts: {output['status']}; {len(output['entries'])} listed")


if __name__ == "__main__":
    main()
