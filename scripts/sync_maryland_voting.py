"""Import Maryland SBE 2026 election PDFs into the voting-site snapshot.
Requires pdfplumber; use the bundled Codex Python runtime if system Python lacks it.
"""
import io
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
EARLY = 'https://elections.maryland.gov/elections/2026/2026_Early_Voting_Centers-GG-EN.pdf'
DROP = 'https://elections.maryland.gov/elections/2026/2026_General_Drop_Box_Locations.pdf'

def fetch_pdf(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 EventAtlas public-data evaluation'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()

def norm(value):
    return re.sub(r'\s+', ' ', value or '').strip()

def base_record(kind, index, county, name, street, city, postal, source, retrieved):
    return dict(id=f'md-{kind}:{index}', sourceId=f'md-{kind}', sourceRecordId=index,
                name=norm(name), type='early_vote_center' if kind == 'early' else 'ballot_drop_box',
                jurisdiction='MD', county=norm(county), city=norm(city), street=norm(street),
                addressLine2='', postal=postal, lat=None, lon=None, precinct=None, ward='',
                status='Published for 2026 general election',
                datesOpen='October 22–29, 2026' if kind == 'early' else 'Through November 3, 2026, 8:00 PM',
                hours='7:00 AM to 8:00 PM' if kind == 'early' else 'Not specified in this PDF',
                votingSpace='', accessibility='', sourceUrl=source, sourceRecordUrl=source,
                sourceDataStatus='2026 general-election PDF; verify current status and exact site details',
                retrievedAt=retrieved, sourceEditedAt=None, coordinateStatus='Not published in source PDF')

def early_records(data, retrieved):
    records = []
    county = None
    pending = []
    city_pattern = re.compile(r'^(.+?),\s*(?:MD|Maryland)?\s*(\d{5})(?:\b|$)', re.I)
    heading = re.compile(r'^(.+?) County \((\d+) centers?\)$')
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page_number, page in enumerate(pdf.pages[:4]):
            for left, right in [(0, page.width / 2), (page.width / 2, page.width)]:
                text = page.crop((left, 70 if page_number == 0 else 0, right, 755)).extract_text() or ''
                for raw in text.splitlines():
                    line = norm(raw)
                    if line.startswith(('151 West Street, Suite 200', 'Local - 410.269.2840')):
                        continue
                    if line.startswith(('2026 Primary and General Elections', 'Determination of Early Voting Centers')):
                        break
                    match_heading = heading.match(line)
                    if match_heading:
                        county = match_heading.group(1)
                        pending = []
                        continue
                    if line == 'Baltimore City (9 centers)':
                        county = 'Baltimore City'
                        pending = []
                        continue
                    city_match = city_pattern.match(line)
                    if city_match and county and len(pending) >= 2:
                        name = ' '.join(pending[:-1])
                        street = pending[-1]
                        records.append(base_record('early', len(records) + 1, county, name, street,
                                                   city_match.group(1), city_match.group(2), EARLY, retrieved))
                        pending = []
                    elif county and line and not line.startswith(('There are locations', 'a location in your', 'early, you cannot', 'e election day.', 'ursday, October')):
                        pending.append(line)
    return records

def drop_records(data, retrieved):
    records = []
    address_pattern = re.compile(r'^(.*?),\s*([^,]+),\s*MD\s*(\d{5})(?:\b|$)', re.I)
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            for row in page.extract_table() or []:
                if len(row) < 3 or not row[0] or not row[1] or not row[2]:
                    continue
                county, name, address = map(norm, row[:3])
                match = address_pattern.match(address)
                if county == 'COUNTY':
                    continue
                if match:
                    record = base_record('drop-box', len(records) + 1, county, name, match.group(1),
                                         match.group(2), match.group(3), DROP, retrieved)
                    record['addressParseStatus'] = 'parsed'
                else:
                    postal = re.search(r'\b(\d{5})\b$', address)
                    record = base_record('drop-box', len(records) + 1, county, name, address, '',
                                         postal.group(1) if postal else '', DROP, retrieved)
                    record['addressParseStatus'] = 'source text preserved; city/street split unverified'
                records.append(record)
    return records

if __name__ == '__main__':
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    early = early_records(fetch_pdf(EARLY), retrieved)
    drop = drop_records(fetch_pdf(DROP), retrieved)
    if len(early) != 102 or len(drop) != 292:
        raise SystemExit(f'PDF layout/count changed: {len(early)} early, {len(drop)} drop boxes; snapshot unchanged')
    path = ROOT / 'data/voting_locations.json'
    current = json.loads(path.read_text())
    current['sources'] = [x for x in current['sources'] if x['id'] not in ('md-early', 'md-drop-box')]
    current['locations'] = [x for x in current['locations'] if x['sourceId'] not in ('md-early', 'md-drop-box')]
    for source_id, title, url, rows in [('md-early', 'Maryland 2026 general-election early voting centers', EARLY, early),
                                        ('md-drop-box', 'Maryland 2026 general-election ballot drop boxes', DROP, drop)]:
        current['sources'].append(dict(id=source_id, name=title, dataset=url, records=len(rows),
                                       reportedCount=len(rows), retrievedAt=retrieved, dataEditedAt=None,
                                       coverageNote='2026 election-specific Maryland SBE PDF; no source coordinates', status='ok'))
        current['locations'].extend(rows)
    current['retrievedAt'] = retrieved
    note = 'Maryland 2026 election PDF addresses have no coordinates in source and are not geocoded.'
    if note not in current['coverageNote']:
        current['coverageNote'] += ' ' + note
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(current, ensure_ascii=False))
    temp.replace(path)
    print(f'Maryland: {len(early)} early voting centers, {len(drop)} ballot drop boxes; total {len(current["locations"])} site-type records')
