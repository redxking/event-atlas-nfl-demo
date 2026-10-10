"""Capture the operator's exact-game Sounder service plan for Seahawks–49ers."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.soundtransit.org/get-to-know-us/news-events/calendar/seahawks-vs-san-francisco-2026-10-11"


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


def local_iso(hour, minute, meridiem):
    hour = int(hour) % 12 + (12 if meridiem.lower() == "p" else 0)
    return f"2026-10-11T{hour:02d}:{int(minute):02d}:00-07:00"


def parse_page(raw, now):
    if not raw or len(raw) > 900_000 or b"<html" not in raw[:500].lower():
        raise ValueError("Sound Transit event page is empty, oversized, or not HTML")
    parser = VisibleText()
    parser.feed(raw.decode("utf-8", "replace"))
    text = " ".join(" ".join(parser.parts).split())
    if not 1000 <= len(text) <= 50000 or "Seahawks vs. San Francisco" not in text or "October 11, 2026 | 1:25 p.m. - 5:00 p.m." not in text or "Sounder trips to and from this game" not in text or "Lumen Field" not in text:
        raise ValueError("Sound Transit page no longer identifies the exact event")
    north = re.search(r"N Line from Everett to Seattle(.{0,800}?)S Line from Lakewood to Seattle", text, re.I)
    south = re.search(r"S Line from Lakewood to Seattle(.{0,1200}?)Return schedule - from Seattle/King Street Station", text, re.I)
    ret_n = re.search(r"N Line trains depart King Street Station 20 and 45 minutes after the game ends", text, re.I)
    ret_s = re.search(r"S Line trains depart King Street Station approximately 10, 20 and 45 minutes after the game ends", text, re.I)
    if not north or not south or not ret_n or not ret_s or not re.search(r"The T Line will also provide additional connecting service to Tacoma Station", text, re.I):
        raise ValueError("Sound Transit timetable or return policy changed")
    arrivals = []
    for line, section, expected_ids, expected_times in [
        ("N", north.group(1), ["1831", "1833"], 2),
        ("S", south.group(1), ["1630", "1632", "1634"], 3),
    ]:
        for trip in expected_ids:
            if not re.search(rf"\b{trip}\b", section):
                raise ValueError(f"Sound Transit {line} Line trip set changed")
        match = re.search(r"\bSeattle\s+((?:\d{1,2}:\d{2}\s*[ap]\.m\.\s*){%d})" % expected_times, section, re.I)
        if not match:
            raise ValueError(f"Sound Transit {line} Line Seattle arrival row changed")
        times = re.findall(r"(\d{1,2}):(\d{2})\s*([ap])\.m\.", match.group(1), re.I)
        if len(times) != expected_times:
            raise ValueError(f"Sound Transit {line} Line arrival count changed")
        for trip, (hour, minute, meridiem) in zip(expected_ids, times):
            arrivals.append({"line": line, "tripId": trip, "seattleArrivalAt": local_iso(hour, minute, meridiem)})
    return {"schema": "event-atlas.sound-transit-seahawks.v1", "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872992", "eventDate": "2026-10-11", "venueId": "3673", "sourceUrl": URL, "sourcePublicationTime": None, "arrivals": arrivals, "northReturnMinutesAfterGameEnd": [20, 45], "southReturnMinutesAfterGameEndApprox": [10, 20, 45], "tLineExtraConnectingService": True, "sourceTextSha256": hashlib.sha256((north.group(0) + south.group(0) + ret_n.group(0) + ret_s.group(0)).encode()).hexdigest(), "interpretation": "Operator-published event service plan, not verified train positions, capacity, departures, or guaranteed event access. Return departures depend on actual game end; the first two S Line return trains may depart as they fill."}


def failed(now):
    return {"schema": "event-atlas.sound-transit-seahawks.v1", "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": "nfl:401872992", "eventDate": "2026-10-11", "venueId": "3673", "sourceUrl": URL, "sourcePublicationTime": None, "arrivals": [], "northReturnMinutesAfterGameEnd": [], "southReturnMinutesAfterGameEndApprox": [], "tLineExtraConnectingService": False, "sourceTextSha256": None}


def main():
    now = datetime.now(timezone.utc)
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 event-service-plan", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("Event-page response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.soundtransit.org" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected event-page response: HTTP {status}")
        output = parse_page(raw, datetime.now(timezone.utc))
    except Exception as error:
        output = failed(now)
        print(f"Sound Transit event plan unavailable: {str(error)[:120]}")
    (ROOT / "site/sound_transit_seahawks.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Sound Transit Seahawks service: {output['status']}; {len(output['arrivals'])} inbound trips listed")


if __name__ == "__main__":
    main()
