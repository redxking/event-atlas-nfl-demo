"""Capture bounded Fulton County rows from Georgia DOT's public incident table."""

import json
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = "https://incidentreport.dot.ga.gov/traffic"
PAGE = "https://incidentreport.dot.ga.gov/"


def displayed_time(value):
    if not isinstance(value, int) or value < 1_500_000_000_000 or value > 4_100_000_000_000:
        return None
    return datetime.fromtimestamp(value / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M")


def short_text(value, limit):
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:limit]


def extract(data, now):
    if not isinstance(data, list) or len(data) > 1000:
        raise ValueError("Georgia incident table is not a bounded array")
    records = []
    for item in data:
        if not isinstance(item, dict) or str(item.get("county", "")).strip().casefold() != "fulton":
            continue
        event_id = item.get("event_id")
        if not isinstance(event_id, int) or event_id <= 0:
            continue
        modified = displayed_time(item.get("modified_date"))
        if not modified:
            continue
        records.append({"id": f"gdot-{event_id}", "category": short_text(item.get("eventType"), 60), "type": short_text(item.get("type"), 50), "publisherStatus": short_text(item.get("status"), 40), "road": short_text(item.get("primary_road"), 100), "crossRoad": short_text(item.get("cross_road"), 100), "detail": short_text(item.get("description"), 300), "publisherDisplayedUpdated": modified, "publisherDisplayedStart": displayed_time(item.get("start_time")), "publisherDisplayedEnd": displayed_time(item.get("end_time")), "sourceUrl": PAGE})
    records.sort(key=lambda item: (item["publisherDisplayedUpdated"], item["id"]), reverse=True)
    unique = list({item["id"]: item for item in records}.values())
    wall_now = now.astimezone(timezone.utc).replace(tzinfo=None)
    recent = [item for item in unique if wall_now - timedelta(days=8) <= datetime.strptime(item["publisherDisplayedUpdated"], "%Y-%m-%d %H:%M") <= wall_now + timedelta(days=1)]
    return {"schema": "event-atlas.georgia-traffic.v1", "status": "ok", "retrievedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "sourcePageUrl": PAGE, "sourceCounty": "Fulton", "totalReturned": len(data), "countyCount": len(unique), "recentCountyCount": len(recent), "olderOmittedCount": len(unique) - len(recent), "records": recent[:10], "timeBasis": "publisher_displayed_wall_time_unverified_zone", "interpretation": "Georgia DOT incident-report table rows for Fulton County only. Rows with publisher-displayed updates older than eight days are omitted; this broad filter tolerates time-zone ambiguity but does not establish active status. The publisher's own table renders numeric timestamps as UTC wall-clock text; their actual time-zone basis is unverified. Dates are shown as publisher-displayed text and are not compared with kickoff. County scope does not establish proximity, route impact, an active incident, police validation, or a threat."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-road-context", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker or len(raw) > 2_000_000:
            raise ValueError("Georgia response lacks metadata or is oversized")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "incidentreport.dot.ga.gov" or final.path != "/traffic":
            raise ValueError(f"Unexpected Georgia response: HTTP {status}")
        output = extract(json.loads(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = {"schema": "event-atlas.georgia-traffic.v1", "status": "failed", "retrievedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "sourcePageUrl": PAGE, "sourceCounty": "Fulton", "totalReturned": None, "countyCount": None, "recentCountyCount": None, "olderOmittedCount": None, "records": [], "timeBasis": "publisher_displayed_wall_time_unverified_zone", "interpretation": "Georgia DOT incident-report table unavailable; no absence or current road condition can be inferred."}
        print(f"Georgia traffic unavailable: {str(error)[:120]}")
    (ROOT / "site/georgia_traffic.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Georgia traffic: {output['status']}; {len(output['records'])} bounded Fulton rows")


if __name__ == "__main__":
    main()
