"""Verify exact-game planned Nashville street closures in the current NDOT PDF."""

import hashlib
import io
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
INDEX = "https://www.nashville.gov/departments/transportation/road-closures"
SCHEMA = "event-atlas.nashville-titans-closures.v1"
GAME_ID = "nfl:401872984"
EVENT_DATE = "2026-10-11"
PERMITS = {
    "2026080985": ("WOODLAND ST", "WOODLAND ST bet 3rd Ave N to S 5th St", ("WOODLAND ST bet 3rd", "Ave N to S 5th St")),
    "2026081000": ("S 1ST ST", "S 1ST ST bet Woodland St to Russell St", ("S 1ST ST bet Woodland", "St to Russell St")),
    "2026081007": ("RUSSELL ST", "RUSSELL ST bet S 1st St to Titans Way", ("RUSSELL ST bet S 1st St", "to Titans Way")),
    "2026081013": ("TITANS WAY", "TITANS WAY / RUSSELL ST - VICTORY LN", ("TITANS WAY / RUSSELL", "ST - VICTORY LN")),
    "2026081031": ("VICTORY AVE", "VICTORY AVE / TITANS WAY - 2ND AVE", ("VICTORY AVE / TITANS", "WAY - 2ND AVE")),
    "2026081033": ("S 1ST ST", "S 1ST ST/ VICTORY LN - DAVIDSON ST", ("S 1ST ST/ VICTORY LN -", "DAVIDSON ST")),
    "2026081036": ("CRUTCHER ST", "CRUTCHER ST/ S 2ND ST - S 5TH ST", ("CRUTCHER ST/ S 2ND", "ST - S 5TH ST")),
}


def fetch(url, expected_path, max_bytes):
    command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-redirs", "2", "--proto-redir", "=https", "--compressed", "--max-time", "30", "--write-out", "\n__EA_META__%{http_code} %{url_effective}", "--header", "User-Agent: EventAtlas/0.4 NDOT-planned-closures", url]
    result = subprocess.run(command, capture_output=True, timeout=35, check=True)
    raw, marker, metadata = result.stdout.rpartition(b"\n__EA_META__")
    status, effective = metadata.decode("utf-8", "replace").split(" ", 1) if marker else ("", "")
    final = urlparse(effective)
    if status != "200" or final.scheme != "https" or final.hostname != "www.nashville.gov" or not expected_path(final.path) or len(raw) > max_bytes:
        raise ValueError("Unexpected NDOT response, redirect, or size")
    return raw, effective


def extract(index_html, pdf_bytes, now, source_url):
    if len(index_html) > 500_000 or not pdf_bytes.startswith(b"%PDF-") or len(pdf_bytes) > 3_000_000:
        raise ValueError("Unexpected NDOT index or PDF size")
    if not re.search(r'href="[^"]*' + re.escape(urlparse(source_url).path) + r'\?[^\"]*"[^>]*>Weekly Right-of-Way and Construction Road Closures Report</a>', index_html.decode("utf-8", "replace"), re.I):
        raise ValueError("Current index does not identify the selected NDOT PDF")
    pdf = PdfReader(io.BytesIO(pdf_bytes))
    if not 1 <= len(pdf.pages) <= 50:
        raise ValueError("Unexpected NDOT PDF page count")
    text = "\n".join(page.extract_text(extraction_mode="layout") or "" for page in pdf.pages)
    if len(text) > 1_000_000 or "ROW & CONSTRUCTION STREET CLOSURES" not in text or "10/10/2026 to 10/17/2026" not in text:
        raise ValueError("NDOT PDF identity or report window changed")
    entries = []
    for permit, (street, segment, fragments) in PERMITS.items():
        anchor = re.search(r"(?m)^\s*" + permit + r"\s+On October 11th, 2026, Nissan Stadium will be hosting the", text)
        if not anchor:
            raise ValueError(f"Expected game permit {permit} absent")
        following = " ".join(text[anchor.start():anchor.start()+450].split())
        if not re.search(r"Titans vs Houston Texans at noon", following) or not re.search(r"8am until 5pm", following) or "MNPD and Apex Officers" not in following:
            raise ValueError(f"Expected game scope for {permit} changed")
        preceding = text[max(0, anchor.start()-2200):anchor.start()]
        rows = list(re.finditer(r"(?m)^\s*" + re.escape(street) + r"\s+10/11/2026\s+10/11/2026\b", preceding))
        if not rows or len(preceding)-rows[-1].start()>1600:
            raise ValueError(f"Expected street/date row for {permit} absent")
        passage = " ".join((preceding[rows[-1].start():] + text[anchor.start():anchor.start()+350]).split())
        if not all(fragment.casefold() in passage.casefold() for fragment in fragments):
            raise ValueError(f"Published street segment for {permit} changed")
        entries.append({"permitNumber": permit, "street": street, "publishedSegment": segment, "date": EVENT_DATE, "plannedStartLocal": "08:00", "plannedEndLocal": "17:00", "sourceUrl": source_url, "sourceTextSha256": hashlib.sha256(passage.encode()).hexdigest()})
    return {"schema": SCHEMA, "status": "ok", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": GAME_ID, "eventDate": EVENT_DATE, "sourceIndexUrl": INDEX, "sourceUrl": source_url, "documentSha256": hashlib.sha256(pdf_bytes).hexdigest(), "reportWindow": "2026-10-10/2026-10-17", "entries": entries, "interpretation": "NDOT permit report lists seven planned game-day street closures from 8 a.m. to 5 p.m. Central on October 11. Permit publication does not verify activation, field status, route impact, or current traffic."}


def main():
    now = datetime.now(timezone.utc)
    try:
        index_raw, _ = fetch(INDEX, lambda path: path == "/departments/transportation/road-closures", 500_000)
        index = index_raw.decode("utf-8", "replace")
        match = re.search(r'href="([^\"]*ROWConstructionRoadClosures-Weekof_101026-101726\.pdf\?ct=\d+)"[^>]*>Weekly Right-of-Way and Construction Road Closures Report</a>', index, re.I)
        if not match:
            raise ValueError("Current weekly report no longer covers October 11")
        source_url = urljoin(INDEX, match[1].replace("&amp;", "&"))
        raw, effective = fetch(source_url, lambda path: bool(re.fullmatch(r"/sites/default/files/2026-10/ROWConstructionRoadClosures-Weekof_101026-101726\.pdf", path)), 3_000_000)
        output = extract(index_raw, raw, now, effective)
    except Exception as error:
        output = {"schema": SCHEMA, "status": "failed", "checkedAt": now.isoformat().replace("+00:00", "Z"), "gameId": GAME_ID, "eventDate": EVENT_DATE, "sourceIndexUrl": INDEX, "sourceUrl": None, "documentSha256": None, "reportWindow": None, "entries": [], "interpretation": "Exact-game NDOT permit report unavailable or changed; no road-closure conclusion follows."}
        print(f"Nashville Titans planned closures unavailable: {str(error)[:140]}")
    (ROOT / "site/nashville_titans_closures.json").write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(f"Nashville Titans planned closures: {output['status']}; {len(output['entries'])} permits")


if __name__ == "__main__":
    main()
