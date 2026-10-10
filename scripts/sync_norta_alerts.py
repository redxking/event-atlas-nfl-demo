"""Read bounded, dated notices from RTA's public service-alert page."""

import hashlib
import html
import json
import re
import subprocess
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.norta.com/ride-with-us/service-alerts"


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def clean(fragment):
    parser = Text()
    parser.feed(fragment)
    return " ".join(html.unescape(" ".join(parser.parts)).split())


def parse_page(raw, now):
    if not raw or len(raw) > 300_000 or b"<html" not in raw[:500].lower():
        raise ValueError("RTA alert response is empty, oversized or not HTML")
    page = raw.decode("utf-8", "replace")
    if '<link rel="canonical" href="' + URL + '"' not in page or "Streetcar Alerts" not in page or "Bus Alerts" not in page:
        raise ValueError("RTA service-alert page identity changed")
    records = []
    panels = re.split(r'(?=<div class="panel-heading"\s+role="tab")', page)
    for panel in panels[1:]:
        route = re.search(r'class="alert-number route_([A-Za-z0-9-]{1,8})"', panel)
        label = re.search(r'<div class="alert-text"><span>(.*?)</span>', panel, re.S)
        if not route or not label:
            continue
        route_id, route_name = route.group(1), clean(label.group(1))[:100]
        mode = "streetcar" if "Streetcar" in route_name else "bus"
        for block in re.findall(r'<div class="panel-content[^\"]*"[^>]*>(.*?)</div>', panel, re.S):
            heading = re.findall(r'<h3[^>]*>(.*?)</h3>', block, re.S)
            description = re.search(r'<h4[^>]*>(.*?)</h4>', block, re.S)
            if len(heading) < 2 or not description:
                continue
            title, as_of, detail = clean(heading[0])[:100], clean(heading[1]), clean(description.group(1))[:360]
            timestamp = re.fullmatch(r'AS OF ([A-Za-z]+ \d{2} \d{4} \d{2}:\d{2} [AP]M)', as_of)
            if not timestamp or not title or not detail:
                continue
            try:
                day = datetime.strptime(timestamp.group(1), "%B %d %Y %I:%M %p").date()
            except ValueError:
                continue
            if day > now.date() + timedelta(days=1) or day < now.date() - timedelta(days=366):
                continue
            passage = " ".join((route_id, route_name, title, as_of, detail))
            records.append({"routeId": route_id, "routeName": route_name, "mode": mode, "title": title, "asOfText": timestamp.group(1), "asOfDate": day.isoformat(), "detail": detail, "sourceTextSha256": hashlib.sha256(passage.encode()).hexdigest(), "sourceUrl": URL})
    if not records or len(records) > 200:
        raise ValueError("RTA notice extraction empty or outside bound")
    recent = [item for item in records if (now.date() - datetime.fromisoformat(item["asOfDate"]).date()).days <= 3]
    recent.sort(key=lambda item: (item["asOfDate"], item["asOfText"]), reverse=True)
    return {"schema": "event-atlas.norta-alert-page.v1", "status": "ok", "retrievedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "listedCount": len(records), "recentCount": len(recent), "recent": recent[:12], "interpretation": "RTA's public page lists service notices, including older notices. Publisher AS OF times are preserved as printed; their time zone and end times are unverified. A recently dated listing is not proof that the condition remains active or affects the stadium."}


def failed(now):
    return {"schema": "event-atlas.norta-alert-page.v1", "status": "failed", "retrievedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "listedCount": None, "recentCount": None, "recent": [], "interpretation": "Public RTA alert page unavailable; no negative condition inferred."}


def main():
    now = datetime.now(timezone.utc)
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-transit-alerts", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("RTA response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "www.norta.com" or final.path != urlparse(URL).path:
            raise ValueError(f"Unexpected RTA page response: HTTP {status}")
        output = parse_page(raw, now)
    except Exception as error:
        output = failed(now)
        print(f"RTA alert page unavailable: {str(error)[:120]}")
    (ROOT / "site/norta_alerts.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"RTA alerts: {output['status']}; {output['listedCount']} listed, {output['recentCount']} dated within 3 days")


if __name__ == "__main__":
    main()
