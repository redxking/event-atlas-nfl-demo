"""Import New Jersey's county-provided 2026 General Election early-voting list."""
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/voting_locations.json'
SOURCE = 'nj-early-general-2026'
PAGE = 'https://www.nj.gov/state/elections/vote-early-voting.shtml'
NOTE = ('New Jersey Division of Elections county-provided early-voting sites for the 2026 General Election. '
        'The page says county entries are being updated. Dates and minimum hours are statewide publisher claims; '
        'some county address text is incomplete. Verify site and hours with the county election office.')


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def parse(data, retrieved):
    root = html.fromstring(data)
    page_text = clean(root.text_content())
    if '2026 General Election' not in page_text or 'October 24, 2026' not in page_text or 'November 1, 2026' not in page_text:
        raise ValueError('New Jersey election period changed')
    if 'Monday-Saturday, 10:00 a.m.' not in page_text or 'Sunday, 10:00 a.m.' not in page_text:
        raise ValueError('New Jersey statewide hours changed')
    rows, counties = [], set()
    for anchor in root.xpath('//a[contains(@class,"card-link") and contains(.,"County Early Voting Poll Locations")]'):
        county = clean(anchor.text_content()).split(' County Early Voting Poll Locations')[0]
        panel_id = (anchor.get('href') or '').lstrip('#')
        panel = root.get_element_by_id(panel_id)
        updated_text = clean(' '.join(panel.xpath('.//tbody/tr[1]//text()')))
        updated_match = re.search(r'updated\s+(\d{2}/\d{2}/26)', updated_text, re.I)
        if not updated_match:
            raise ValueError(f'New Jersey {county} update date missing')
        updated = datetime.strptime(updated_match.group(1), '%m/%d/%y').date().isoformat()
        counties.add(county)
        for tr in panel.xpath('.//tbody/tr[td/strong]'):
            cell = tr.xpath('./td')[0]
            municipality = clean(' '.join(cell.xpath('./strong//text()'))).lstrip('*')
            fragments = [clean(x) for x in cell.xpath('./text()') if clean(x)]
            source_address = clean(' '.join(fragments))
            if not re.match(r'^EVC\b', municipality, re.I) or not source_address or ',' not in source_address:
                raise ValueError(f'New Jersey {county} row changed: {municipality!r}, {source_address!r}')
            name = source_address.split(',', 1)[0]
            postal_match = re.search(r'\b(\d{5})\b', source_address)
            key = hashlib.sha256(f'{county}|{municipality}|{source_address}'.encode()).hexdigest()[:20]
            rows.append(dict(id=f'{SOURCE}:{key}', sourceId=SOURCE, sourceRecordId=key,
                             name=name, jurisdiction='NJ', county=county, city='', street=source_address,
                             addressLine2='', postal=postal_match.group(1) if postal_match else '',
                             lat=None, lon=None, precinct=None, ward='', votingSpace='', accessibility='',
                             sourceUrl=PAGE, sourceRecordUrl=f'{PAGE}#{panel_id}',
                             retrievedAt=retrieved, sourceEditedAt=updated, municipalityLabel=municipality,
                             coordinateStatus='Not published on state page', type='early_vote_center',
                             status='Published for November 3, 2026 General Election early voting',
                             datesOpen='October 24–November 1, 2026',
                             hours='Monday–Saturday 10:00 a.m.–8:00 p.m.; Sunday 10:00 a.m.–6:00 p.m.',
                             sourceDataStatus=NOTE))
    if len(counties) != 21 or len(rows) < 150 or len({row['id'] for row in rows}) != len(rows):
        raise ValueError(f'New Jersey county coverage or row IDs changed: {len(counties)} counties, {len(rows)} rows')
    return rows


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    prior = next((source for source in snapshot['sources'] if source['id'] == SOURCE), None)
    try:
        data = subprocess.run(['curl', '-fLsS', '--max-time', '45', '-A', 'Mozilla/5.0', PAGE],
                              capture_output=True, check=True).stdout
        rows = parse(data, retrieved)
        source = dict(id=SOURCE, name='New Jersey November 2026 early-voting sites', dataset=PAGE,
                      publisherPage=PAGE, records=len(rows), reportedCount=len(rows), retrievedAt=retrieved,
                      dataEditedAt=max(row['sourceEditedAt'] for row in rows),
                      sourceDigest=hashlib.sha256(data).hexdigest(), coverageNote=NOTE, status='ok')
        print(f'New Jersey: {len(rows)} early-voting sites in {len(set(row["county"] for row in rows))} counties')
    except Exception as error:
        rows = [row for row in snapshot['locations'] if row['sourceId'] == SOURCE]
        source = dict(id=SOURCE, name='New Jersey November 2026 early-voting sites', dataset=PAGE,
                      publisherPage=PAGE, records=len(rows), retrievedAt=retrieved,
                      lastSuccessfulAt=(prior or {}).get('retrievedAt') if rows else None,
                      coverageNote=NOTE, status='stale_retained' if rows else 'error', error=str(error))
        print(f'New Jersey: {error}; retained {len(rows)} prior rows')
    snapshot['sources'] = [item for item in snapshot['sources'] if item['id'] != SOURCE] + [source]
    snapshot['locations'] = [row for row in snapshot['locations'] if row['sourceId'] != SOURCE] + rows
    snapshot['retrievedAt'] = retrieved
    snapshot['coverageNote'] = ('Official-source site-type records for NY, DC, MD, PA, NC, WA, SC, WV, DE, FL, CT and NJ. '
                                'Election-specific scope varies. Verify current site status with election officials.')
    temp = SNAPSHOT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    temp.replace(SNAPSHOT)
    print(f'Wrote {len(snapshot["locations"])} voting-site rows')


if __name__ == '__main__':
    main()
