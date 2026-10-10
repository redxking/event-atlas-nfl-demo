"""Capture the bounded Train Alerts preview published on MARTA's homepage."""

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
URL = "https://itsmarta.com/"
ALERT_PAGE = "https://itsmarta.com/ride/alerts"


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, value):
        self.parts.append(value)


def extract(raw, now):
    if raw and (len(raw) > 800_000 or b"<html" not in raw[:500].lower()):
        raise ValueError("MARTA homepage is oversized or not HTML")
    html = raw.decode("utf-8", "replace")
    blocks = re.split(r"<div\s+tabindex=['\"]0['\"]\s+class=['\"]mini-service-updates__item['\"]>", html)
    train = next((block for block in blocks[1:] if "mini-service-updates__trigger-label--train" in block[:1000]), None)
    if raw and train is None:
        raise ValueError("MARTA Train Alerts preview not found")
    alerts = []
    listed = None
    if train is not None:
        count = re.search(r"mini-service-updates__alert-number['\"]>(\d{1,2})<", train)
        listed = int(count.group(1)) if count else None
        for block in re.findall(r"<li\s+class=['\"]mini-service-updates__alert['\"]>(.*?)</li>", train, re.S | re.I)[:10]:
            parser = VisibleText()
            parser.feed(block)
            text = " ".join(" ".join(parser.parts).split())
            expiry = re.search(r"Expire at:\s*(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}\s+[AP]M)", text, re.I)
            if not expiry:
                continue
            detail = text[:expiry.start()].strip()
            try:
                expires_at = datetime.strptime(expiry.group(1).upper(), "%m/%d/%Y %I:%M %p").replace(tzinfo=ZoneInfo("America/New_York")).astimezone(timezone.utc)
            except ValueError:
                continue
            if not 8 <= len(detail) <= 500 or expires_at <= now or expires_at.timestamp() > now.timestamp() + 400 * 86400:
                continue
            alerts.append({"id": hashlib.sha256(f"{detail}|{expires_at.isoformat()}".encode()).hexdigest()[:16], "detail": detail, "expiresAt": expires_at.isoformat().replace("+00:00", "Z"), "sourceUrl": ALERT_PAGE, "sourceTextSha256": hashlib.sha256(text.encode()).hexdigest()})
    alerts = alerts[:5]
    return {"schema": "event-atlas.marta-alert-preview.v1", "status": "ok" if train is not None and listed is not None else "failed", "retrievedAt": now.isoformat().replace("+00:00", "Z"), "sourceUrl": URL, "alertPageUrl": ALERT_PAGE, "sourceCategory": "Train Alerts", "listedCount": listed, "alerts": alerts, "previewLimited": True, "interpretation": "Homepage preview only. A listed notice is operator text, not verified current operation, stadium relevance, or complete rail-alert coverage. No visible item is not an all-clear."}


def main():
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "25", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 public-transit-alert-preview", URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b"\n__EA_META__")
        if not marker:
            raise ValueError("MARTA response lacks metadata")
        status, effective = metadata.decode("utf-8", "replace").split(" ", 1)
        final = urlparse(effective)
        if status != "200" or final.scheme != "https" or final.hostname != "itsmarta.com" or final.path != "/":
            raise ValueError(f"Unexpected MARTA response: HTTP {status}")
        output = extract(raw, datetime.now(timezone.utc))
    except Exception as error:
        output = extract(b"", datetime.now(timezone.utc))
        print(f"MARTA Train Alerts preview unavailable: {str(error)[:120]}")
    (ROOT / "site/marta_alert_preview.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"MARTA Train Alerts preview: {output['status']}; {len(output['alerts'])} bounded unexpired items")


if __name__ == "__main__":
    main()
