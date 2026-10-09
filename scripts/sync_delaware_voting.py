"""Import Delaware's official 2026 general-election voting-site tables."""
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from lxml import html

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/voting_locations.json'
BASE = 'https://elections.delaware.gov/elections/'
INDEX = urljoin(BASE, 'votinglocations.html')
GENERAL = urljoin(BASE, 'general/general.html')
SOURCE_EARLY = 'de-early-general-2026'
SOURCE_DAY = 'de-election-day-general-2026'
NOTE_EARLY = ('Delaware Department of Elections 2026 General Election early-voting table; '
              'published statewide daily schedule applies to these sites. Confirm current status with the Department.')
NOTE_DAY = ('Delaware Department of Elections 2026 General Election polling-place tables. '
            'One row per distinct published election-district/place mapping, not a voter assignment. '
            'Confirm current assignment and operation with the Department.')


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def fetch(url):
    result = subprocess.run(['curl', '-fLsS', '--max-time', '30', url], capture_output=True, check=True)
    return result.stdout


def identifier(*parts):
    return hashlib.sha256('|'.join(parts).encode()).hexdigest()[:20]


def base_row(source_id, county, name, address, retrieved):
    zip_match = re.search(r'\bDE\s+(\d{5})', address)
    if not name or not zip_match:
        raise ValueError(f'Delaware missing name or ZIP: {county}: {name}: {address}')
    return dict(sourceId=source_id, name=name, jurisdiction='DE', county=county,
                city='', street=address[:zip_match.end()].strip(), addressLine2='',
                postal=zip_match.group(1), lat=None, lon=None, ward='', votingSpace='',
                accessibility='', retrievedAt=retrieved, sourceEditedAt=None,
                coordinateStatus='Not published on source page')


def parse_early(document, retrieved):
    sections = document.xpath('//h2[contains(normalize-space(.),"2026 General Election Early Voting Schedule")]')
    if len(sections) != 1:
        raise ValueError('Delaware 2026 General Election early-voting heading changed')
    heading = sections[0]
    schedule_list = heading.xpath('following-sibling::ul[1]')
    schedule = clean(schedule_list[0].text_content()) if schedule_list else ''
    expected = ['October 22, 2026', 'October 24, 2026', 'October 25, 2026',
                'October 26, 2026', 'October 27, 2026', 'October 28, 2026', 'November 1, 2026']
    if not all(value in schedule for value in expected) or 'NO EARLY VOTING' not in schedule:
        raise ValueError('Delaware early-voting dates changed')
    dates = 'October 22–24, 26–27 and 28–November 1, 2026; closed October 25'
    hours = 'October 22–24 and 26–27: 7 a.m.–7 p.m.; October 28–November 1: 11 a.m.–7 p.m.'
    rows = []
    node = heading.getnext()
    while node is not None and node.tag != 'h2':
        if node.tag == 'div':
            for table in node.xpath('.//table[.//th[contains(.,"EARLY VOTING SITE NAME")]]'):
                county_heading = table.xpath('preceding::h3[1]')
                county = clean(county_heading[0].text_content()).removesuffix(' County Early Voting Sites') if county_heading else ''
                if county not in ('Kent', 'New Castle', 'Sussex'):
                    raise ValueError(f'Delaware early-vote county changed: {county}')
                for tr in table.xpath('.//tr')[1:]:
                    cells = [clean(cell.text_content()) for cell in tr.xpath('./th|./td')]
                    if len(cells) != 2:
                        raise ValueError(f'Delaware early-vote table changed: {cells}')
                    name, address = cells
                    row = base_row(SOURCE_EARLY, county, name, address, retrieved)
                    key = identifier(county, name, row['street'])
                    row.update(id=f'{SOURCE_EARLY}:{key}', sourceRecordId=key, type='early_vote_center',
                               precinct=None, status='Published for November 3, 2026 General Election early voting',
                               datesOpen=dates, hours=hours, description=address[len(row['street']):].strip(),
                               sourceUrl=INDEX, sourceRecordUrl=INDEX, sourceDataStatus=NOTE_EARLY)
                    rows.append(row)
        node = node.getnext()
    if len(rows) != 19 or {row['county'] for row in rows} != {'Kent', 'New Castle', 'Sussex'}:
        raise ValueError(f'Delaware early-vote list changed: {len(rows)} sites')
    return rows


def parse_day(index, retrieved):
    headings = index.xpath('//h2[contains(normalize-space(.),"2026 General Election Day Polling Places")]')
    if len(headings) != 1:
        raise ValueError('Delaware 2026 General Election Day heading changed')
    anchor_table = headings[0].getnext()
    if anchor_table is None or anchor_table.tag != 'table' or '11/3/2026 General Election Polling Places' not in clean(anchor_table.text_content()):
        raise ValueError('Delaware 2026 General Election Day links changed')
    expected = {'Kent': 'votinglocations_kent_general.html',
                'New Castle': 'votinglocations_newcastle_general.html',
                'Sussex': 'votinglocations_sussex_general.html'}
    links = {a.get('href', '').split('/')[-1] for a in anchor_table.xpath('.//a')}
    if not set(expected.values()).issubset(links):
        raise ValueError('Delaware county polling-place links changed')
    rows = []
    digests = []
    duplicate_lines = 0
    expected_counts = {'Kent': 98, 'New Castle': 316, 'Sussex': 119}
    for county, page in expected.items():
        url = urljoin(BASE, page)
        data = fetch(url)
        digests.append(hashlib.sha256(data).hexdigest())
        document = html.fromstring(data)
        if clean(document.xpath('string(//h1)')) != f'{county} County':
            raise ValueError(f'Delaware county page changed: {county}')
        if 'Polling Places for 2026 General' not in clean(document.text_content()):
            raise ValueError(f'Delaware county election context changed: {county}')
        tables = document.xpath('//table[.//th[contains(.,"ELECTION DISTRICT")]]')
        if len(tables) != 1:
            raise ValueError(f'Delaware county polling table changed: {county}')
        seen = set()
        for tr in tables[0].xpath('.//tr')[1:]:
            cells = [clean(cell.text_content()) for cell in tr.xpath('./th|./td')]
            if len(cells) != 3 or not re.fullmatch(r'\d{2}-\d{2}', cells[0]):
                raise ValueError(f'Delaware district row changed: {county}: {cells}')
            precinct, name, address = cells
            row = base_row(SOURCE_DAY, county, name, address, retrieved)
            key = identifier(county, precinct, name, row['street'])
            if key in seen:
                duplicate_lines += 1
                continue
            seen.add(key)
            row.update(id=f'{SOURCE_DAY}:{key}', sourceRecordId=key,
                       type='election_day_polling_place', precinct=precinct,
                       status='Published for November 3, 2026 General Election',
                       datesOpen='November 3, 2026', hours='7 a.m.–8 p.m.',
                       sourceUrl=url, sourceRecordUrl=url, sourceDataStatus=NOTE_DAY)
            rows.append(row)
        if len(seen) != expected_counts[county]:
            raise ValueError(f'Delaware {county} county row count changed: {len(seen)}')
    if len(rows) != 533 or duplicate_lines != 7 or len({row['id'] for row in rows}) != len(rows):
        raise ValueError(f'Delaware polling tables changed: {len(rows)} distinct rows, {duplicate_lines} duplicates')
    return rows, digests, duplicate_lines


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    try:
        raw = fetch(INDEX)
        document = html.fromstring(raw)
        general = fetch(GENERAL)
        if 'Polling Places are open from 7 a.m. until 8 p.m. on General Election Day, November 3, 2026' not in clean(html.fromstring(general).text_content()):
            raise ValueError('Delaware general-election hours changed')
        early = parse_early(document, retrieved)
        day, digests, duplicates = parse_day(document, retrieved)
        rows = early + day
        sources = [dict(id=source_id, name=name, dataset=INDEX, publisherPage=INDEX,
                        records=len(items), reportedCount=len(items), retrievedAt=retrieved,
                        dataEditedAt=None, sourceDigest=hashlib.sha256(raw + general + ''.join(digests).encode()).hexdigest(),
                        sourceDuplicateLines=duplicates if source_id == SOURCE_DAY else 0,
                        coverageNote=note, status='ok')
                   for source_id, name, items, note in (
                       (SOURCE_EARLY, 'Delaware November 2026 early-voting sites', early, NOTE_EARLY),
                       (SOURCE_DAY, 'Delaware November 2026 Election Day polling places', day, NOTE_DAY))]
        print(f'Delaware: {len(early)} early-vote sites, {len(day)} distinct district/place rows; {duplicates} duplicate source lines')
    except Exception as error:
        rows = [row for row in snapshot['locations'] if row['sourceId'] in (SOURCE_EARLY, SOURCE_DAY)]
        sources = []
        for source_id, name, note in (
            (SOURCE_EARLY, 'Delaware November 2026 early-voting sites', NOTE_EARLY),
            (SOURCE_DAY, 'Delaware November 2026 Election Day polling places', NOTE_DAY)):
            prior = next((source for source in snapshot['sources'] if source['id'] == source_id), None)
            count = sum(row['sourceId'] == source_id for row in rows)
            sources.append(dict(id=source_id, name=name, dataset=INDEX, publisherPage=INDEX,
                                records=count, retrievedAt=retrieved,
                                lastSuccessfulAt=(prior or {}).get('retrievedAt') if count else None,
                                coverageNote=note, status='stale_retained' if count else 'error', error=str(error)))
        print(f'Delaware: {error}; retained {len(rows)} prior rows')
    snapshot['sources'] = [s for s in snapshot['sources'] if s['id'] not in (SOURCE_EARLY, SOURCE_DAY)] + sources
    snapshot['locations'] = [r for r in snapshot['locations'] if r['sourceId'] not in (SOURCE_EARLY, SOURCE_DAY)] + rows
    snapshot['retrievedAt'] = retrieved
    snapshot['coverageNote'] = ('Official-source site-type records for NY, DC, MD, PA, NC, WA, SC, WV and DE. '
                                'Election-specific scope varies. Verify current site status with election officials.')
    temp = SNAPSHOT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    temp.replace(SNAPSHOT)
    print(f'Wrote {len(snapshot["locations"])} voting-site rows')


if __name__ == '__main__':
    main()
