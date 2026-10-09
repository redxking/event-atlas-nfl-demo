"""Import the NCSBE November 2026 early-voting site list without geocoding."""
import hashlib
import io
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/voting_locations.json'
SOURCE_ID = 'nc-early-nov-2026'
PAGE = 'https://www.ncsbe.gov/results-data/polling-place-data'
PDF = 'https://s3.amazonaws.com/dl.ncsbe.gov/One-Stop_Early_Voting/2026/Early_Voting_Site_List_November_2026.pdf'
NOTE = 'NCSBE November 3, 2026 election early-voting PDF; dates and hours are publisher claims. No point coordinates are supplied. Verify changes with the county board of elections.'
CITY = re.compile(r'^(.+?),\s*NC\s+(\d{5})(?:\b|$)', re.I)


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def fetch():
    request = urllib.request.Request(PDF, headers={'User-Agent': 'Mozilla/5.0 EventAtlas public-data evaluation'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def parse(data, retrieved):
    rows = []
    counties = set()
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        if len(pdf.pages) != 46:
            raise ValueError(f'Unexpected NCSBE PDF page count: {len(pdf.pages)}')
        for page_index, page in enumerate(pdf.pages):
            for table in page.extract_tables():
                county = None
                for cells in table:
                    if not cells or len(cells) < 5 or cells[0] == 'County' or (cells[0] or '').startswith('Early Voting Sites'):
                        continue
                    if cells[0]:
                        county = clean(cells[0])
                        counties.add(county)
                    if not county:
                        raise ValueError(f'NCSBE row without county on page {page_index + 1}')
                    site = cells[1] or cells[2] or ''
                    lines = [clean(line) for line in site.splitlines() if clean(line)]
                    lines = [line for line in lines if not line.startswith('*Instead of voting')]
                    if len(lines) < 3:
                        raise ValueError(f'Incomplete NCSBE site on page {page_index + 1}')
                    match = CITY.match(lines[-1])
                    if not match:
                        raise ValueError(f'NCSBE city/ZIP not parsed on page {page_index + 1}: {lines[-1]}')
                    name, street = clean(' '.join(lines[:-2])), lines[-2]
                    dates = [clean(line) for line in (cells[3] or '').splitlines() if clean(line)]
                    hours = [clean(line) for line in (cells[4] or '').splitlines() if clean(line)]
                    if not name or not street or not dates or len(dates) != len(hours):
                        raise ValueError(f'NCSBE schedule mismatch on page {page_index + 1}')
                    digest = hashlib.sha256('|'.join((county, name, street, match.group(1), match.group(2))).encode()).hexdigest()[:20]
                    rows.append(dict(id=f'{SOURCE_ID}:{digest}', sourceId=SOURCE_ID, sourceRecordId=digest,
                                     name=name, type='early_vote_center', jurisdiction='NC', county=county,
                                     city=clean(match.group(1)), street=street, addressLine2='', postal=match.group(2),
                                     lat=None, lon=None, precinct=None, ward='',
                                     status='Published for November 3, 2026 early voting',
                                     datesOpen=' | '.join(dates), hours=' | '.join(hours),
                                     schedule=[dict(dates=date, hours=hour) for date, hour in zip(dates, hours)],
                                     votingSpace='', accessibility='', sourceUrl=PAGE,
                                     sourceRecordUrl=f'{PDF}#page={page_index + 1}', sourceDataStatus=NOTE,
                                     retrievedAt=retrieved, sourceEditedAt=None,
                                     coordinateStatus='Not published in source PDF', sourcePage=page_index + 1))
    if len(rows) != 371 or len(counties) != 100 or len({row['id'] for row in rows}) != len(rows):
        raise ValueError(f'NCSBE layout/count changed: {len(rows)} rows, {len(counties)} counties')
    return rows


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    try:
        rows = parse(fetch(), retrieved)
        source = dict(id=SOURCE_ID, name='North Carolina November 2026 early-voting sites',
                      dataset=PDF, publisherPage=PAGE, records=len(rows), reportedCount=len(rows),
                      retrievedAt=retrieved, dataEditedAt=None, coverageNote=NOTE, status='ok')
        print(f'{SOURCE_ID}: {len(rows)} rows across 100 counties')
    except Exception as error:
        rows = [row for row in snapshot['locations'] if row['sourceId'] == SOURCE_ID]
        previous = next((source for source in snapshot['sources'] if source['id'] == SOURCE_ID), None)
        last_success = rows[0]['retrievedAt'] if rows else None
        source = dict(id=SOURCE_ID, name='North Carolina November 2026 early-voting sites',
                      dataset=PDF, publisherPage=PAGE, records=len(rows), retrievedAt=retrieved,
                      lastSuccessfulAt=last_success or (previous or {}).get('lastSuccessfulAt'),
                      coverageNote=NOTE, status='stale_retained' if rows else 'error', error=str(error))
        print(f'{SOURCE_ID}: {error}; retained {len(rows)} prior rows')
    snapshot['sources'] = [source for source in snapshot['sources'] if source['id'] != SOURCE_ID] + [source]
    snapshot['locations'] = [row for row in snapshot['locations'] if row['sourceId'] != SOURCE_ID] + rows
    snapshot['retrievedAt'] = retrieved
    snapshot['coverageNote'] = 'Official-source site-type records for NY, DC, MD, PA and NC. NC November 2026 early voting has published schedules; NC November Election Day locations are not yet published on the NCSBE download page. Other coverage is dated or incomplete. Verify current site status with election officials.'
    temp = SNAPSHOT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    temp.replace(SNAPSHOT)
    print(f'Wrote {len(snapshot["locations"])} voting-site rows')


if __name__ == '__main__':
    main()
