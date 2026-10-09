"""Import Connecticut's rolling November 2026 early-voting location list."""
import hashlib
import html
import io
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/voting_locations.json'
SOURCE = 'ct-early-general-2026'
PAGE = 'https://portal.ct.gov/sots/election-services/early-voting/early-voting-locations---2026'
NOTE = ('Connecticut Secretary of the State rolling list for the November 3, 2026 State Election. '
        'The publisher says locations are added as they become available. The PDF does not give site hours or coordinates; '
        'verify the current location and hours with the municipality before use.')


def fetch(url):
    return subprocess.run(['curl', '-fLsS', '--max-time', '45', '-A', 'Mozilla/5.0', url],
                          capture_output=True, check=True).stdout


def parse_pdf(data, url, retrieved):
    results = []
    updated = None
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        if not 4 <= len(pdf.pages) <= 10:
            raise ValueError(f'Connecticut PDF page count changed: {len(pdf.pages)}')
        for page_number, page in enumerate(pdf.pages, 1):
            top = page.extract_text() or ''
            if 'November 3, 2026 State Election' not in top or 'rolling basis' not in top:
                raise ValueError(f'Connecticut election title or rolling notice changed on page {page_number}')
            match = re.search(r'Last updated (\d{1,2}/\d{1,2}/2026)', top)
            if not match:
                raise ValueError(f'Connecticut publication date missing on page {page_number}')
            if updated and updated != match.group(1):
                raise ValueError('Connecticut PDF pages disagree on publication date')
            updated = match.group(1)
            tables = page.find_tables()
            if len(tables) != 1:
                raise ValueError(f'Connecticut municipality table changed on page {page_number}')
            table = tables[0]
            cells = table.extract()
            for index, row in enumerate(table.rows[1:], 1):
                town = re.sub(r'\s+', ' ', cells[index][0] or '').strip()
                address = re.sub(r'\s+', ' ', page.crop((150, row.bbox[1], 550, row.bbox[3])).extract_text() or '').strip()
                if not town or not address or not re.search(r'\b\d{5}\b', address):
                    raise ValueError(f'Connecticut incomplete row on page {page_number}: {town!r} {address!r}')
                name = address.split(',', 1)[0].strip()
                key = hashlib.sha256(f'{town}|{address}'.encode()).hexdigest()[:20]
                postal = re.search(r'\b(\d{5})\b', address).group(1)
                results.append(dict(id=f'{SOURCE}:{key}', sourceId=SOURCE, sourceRecordId=key,
                                    name=name, jurisdiction='CT', county=town, city='', street=address,
                                    addressLine2='', postal=postal, lat=None, lon=None, precinct=None, ward='',
                                    votingSpace='', accessibility='', sourceUrl=url, sourceRecordUrl=url,
                                    sourcePage=page_number, retrievedAt=retrieved, sourceEditedAt=None,
                                    coordinateStatus='Not published in state PDF', type='early_vote_center',
                                    status='Published for November 3, 2026 State Election early voting',
                                    datesOpen='', hours='', sourceDataStatus=NOTE))
    if len(results) < 150 or len({row['id'] for row in results}) != len(results):
        raise ValueError(f'Connecticut source unexpectedly sparse or duplicated: {len(results)} rows')
    return results, datetime.strptime(updated, '%m/%d/%Y').date().isoformat()


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    prior = next((source for source in snapshot['sources'] if source['id'] == SOURCE), None)
    try:
        page = fetch(PAGE).decode('utf-8')
        links = re.findall(r'href="([^"]*early-voting-locations--november-3--2026\.pdf[^"]*)"', page, re.I)
        if len(links) != 1:
            raise ValueError(f'Connecticut PDF link changed: {len(links)} candidates')
        url = html.unescape(links[0])
        data = fetch(url)
        rows, edited = parse_pdf(data, url, retrieved)
        source = dict(id=SOURCE, name='Connecticut November 2026 early-voting locations', dataset=url,
                      publisherPage=PAGE, records=len(rows), reportedCount=len(rows), retrievedAt=retrieved,
                      dataEditedAt=edited, sourceDigest=hashlib.sha256(data).hexdigest(),
                      coverageNote=NOTE, status='ok')
        print(f'Connecticut: {len(rows)} published early-voting sites in {len(set(row["county"] for row in rows))} municipalities')
    except Exception as error:
        rows = [row for row in snapshot['locations'] if row['sourceId'] == SOURCE]
        source = dict(id=SOURCE, name='Connecticut November 2026 early-voting locations',
                      dataset=(prior or {}).get('dataset', PAGE), publisherPage=PAGE, records=len(rows),
                      retrievedAt=retrieved, lastSuccessfulAt=(prior or {}).get('retrievedAt') if rows else None,
                      coverageNote=NOTE, status='stale_retained' if rows else 'error', error=str(error))
        print(f'Connecticut: {error}; retained {len(rows)} prior rows')
    snapshot['sources'] = [source_item for source_item in snapshot['sources'] if source_item['id'] != SOURCE] + [source]
    snapshot['locations'] = [row for row in snapshot['locations'] if row['sourceId'] != SOURCE] + rows
    snapshot['retrievedAt'] = retrieved
    snapshot['coverageNote'] = ('Official-source site-type records for NY, DC, MD, PA, NC, WA, SC, WV, DE, FL and CT. '
                                'Election-specific scope varies. Verify current site status with election officials.')
    temp = SNAPSHOT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    temp.replace(SNAPSHOT)
    print(f'Wrote {len(snapshot["locations"])} voting-site rows')


if __name__ == '__main__':
    main()
