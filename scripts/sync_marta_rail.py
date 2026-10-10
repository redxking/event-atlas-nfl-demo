"""Capture MARTA's published Oct. 11 rail frequencies for Atlanta event planning."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://itsmarta.com/special-rail-schedules.aspx"
DATE = "Sunday, October 11, 2026"
PATTERN = r"(?P<line>Gold|Red|Blue|Green) Line YES (?P<frequency>12 min until 6:30pm, 15 min until 9pm, 20 min after 9pm) (?P<destination>.+?) View Schedule"


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def extract(raw, now):
    if raw and (len(raw) > 1_000_000 or b"<html" not in raw[:500].lower()):
        raise ValueError("MARTA schedule is oversized or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    body = " ".join(" ".join(parser.parts).split())
    claims = []
    if DATE in body:
        section = body.split(DATE, 1)[1].split("Monday, October 12", 1)[0]
        for match in re.finditer(PATTERN, section, re.I):
            line = match.group("line").lower()
            if line not in {"gold", "red", "blue", "green"} or len(match.group("destination")) > 100:
                continue
            claims.append({"id": f"{line}_line", "category": "published_rail_frequency", "line": match.group("line").title(), "summary": f"MARTA lists {match.group('line').title()} Line trains every 12 minutes until 6:30 p.m., 15 minutes until 9 p.m., and 20 minutes after 9 p.m. on October 11; actual service is unverified.", "destination": match.group("destination"), "sourceUrl": URL, "sourceTextSha256": hashlib.sha256(match.group(0).encode()).hexdigest()})
    claims = list({item["id"]: item for item in claims}.values())[:4]
    missing = [f"{line}_line" for line in ("gold", "red", "blue", "green") if not any(item["id"] == f"{line}_line" for item in claims)]
    return {"schema": "event-atlas.marta-rail.v1", "status": "ok" if not missing else "partial" if claims else "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "serviceDate": "2026-10-11", "sourceUrl": URL, "sourcePublicationTime": None, "claims": claims, "missingClaimIds": missing, "interpretation": "MARTA's published regional schedule for the game date. This is not a live train position, confirmed operation, station condition, event-specific extra service, or verified venue impact."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-transit-schedule", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("MARTA response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "itsmarta.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected MARTA response: HTTP {status}")
        output = extract(raw, datetime.now(timezone.utc))
    except Exception as error:
        output = extract(b"", datetime.now(timezone.utc))
        print(f"MARTA schedule unavailable: {str(error)[:120]}")
    (ROOT / "site/marta_rail.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"MARTA Oct. 11 rail: {output['status']}; {len(output['claims'])}/4 lines checked")


if __name__ == "__main__":
    main()
