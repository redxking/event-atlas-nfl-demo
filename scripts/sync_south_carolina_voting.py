"""Import official South Carolina 2026 statewide general-election early voting centers."""
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/voting_locations.json'
SOURCE_ID = 'sc-early-general-2026'
PAGE = 'https://scvotes.gov/voters/early-voting/'
NOTE = ('South Carolina Election Commission 2026 General Election early-voting list. '
        'Published statewide period and hours apply to these listed centers; no source coordinates. '
        'Verify changes and site operation with the county voter registration office.')
DATES = 'October 19–31, 2026; closed Sunday, October 25'
HOURS = '8:30 a.m.–6:00 p.m. Monday–Saturday'


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def fetch():
    request = urllib.request.Request(PAGE, headers={'User-Agent': 'Mozilla/5.0 EventAtlas public-data evaluation'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def parse(data, retrieved):
    document = html.fromstring(data)
    title = clean(document.xpath('string(//title)'))
    page_text = clean(document.text_content())
    if '2026 Statewide General Election' not in title or 'Monday, October 19 - Saturday, October 31' not in page_text:
        raise ValueError('South Carolina election or date text changed')
    if '8:30 a.m.- 6:00 p.m.' not in page_text or 'Closed Sunday, October 25' not in page_text:
        raise ValueError('South Carolina hours or closure text changed')
    anchors = document.xpath('//a[@id="abbeville" and contains(@class,"accordion-row-toggle")]')
    if len(anchors) != 1:
        raise ValueError('South Carolina county list anchor missing')
    groups = anchors[0].getparent().getparent().xpath('./div[contains(@class,"accordion-row")]')
    rows = []
    counties = set()
    for group in groups:
        anchor = group.xpath('./a[contains(@class,"accordion-row-toggle")]')
        if len(anchor) != 1:
            raise ValueError('South Carolina county heading changed')
        county = clean(anchor[0].text_content())
        county_anchor = anchor[0].get('id')
        counties.add(county)
        intro = clean(group.xpath('string(./div[contains(@class,"accordion-row-content")]/p[1])'))
        if f'in {county} County' not in intro:
            raise ValueError(f'South Carolina county election context changed: {county}')
        locations = group.xpath('./div[contains(@class,"accordion-row-content")]//li')
        if not locations:
            raise ValueError(f'South Carolina county has no listed center: {county}')
        for item in locations:
            full = clean(item.text_content())
            if ':' not in full:
                raise ValueError(f'South Carolina site missing name/address delimiter: {county}')
            name, address = (clean(part) for part in full.split(':', 1))
            match = re.search(r'(?<!\d)(29\d{3})\b', address)
            if not name or not address or not match:
                raise ValueError(f'South Carolina site missing name/address/ZIP: {county}: {full}')
            digest = hashlib.sha256('|'.join((county, name, address)).encode()).hexdigest()[:20]
            rows.append(dict(id=f'{SOURCE_ID}:{digest}', sourceId=SOURCE_ID, sourceRecordId=digest,
                             name=name, type='early_vote_center', jurisdiction='SC', county=county,
                             city='', street=address, addressLine2='', postal=match.group(1),
                             lat=None, lon=None, precinct=None, ward='',
                             status='Published for November 3, 2026 General Election early voting',
                             datesOpen=DATES, hours=HOURS, votingSpace='', accessibility='',
                             sourceUrl=PAGE, sourceRecordUrl=f'{PAGE}#{county_anchor}',
                             sourceDataStatus=NOTE, retrievedAt=retrieved, sourceEditedAt=None,
                             coordinateStatus='Not published on source page'))
    if len(rows) != 140 or len(counties) != 46 or len({row['id'] for row in rows}) != len(rows):
        raise ValueError(f'South Carolina list changed: {len(rows)} sites, {len(counties)} counties')
    return rows, hashlib.sha256(data).hexdigest()


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    try:
        rows, digest = parse(fetch(), retrieved)
        source = dict(id=SOURCE_ID, name='South Carolina November 2026 early-voting centers',
                      dataset=PAGE, publisherPage=PAGE, records=len(rows), reportedCount=len(rows),
                      retrievedAt=retrieved, dataEditedAt=None, sourceDigest=digest,
                      coverageNote=NOTE, status='ok')
        print(f'{SOURCE_ID}: {len(rows)} centers across 46 counties')
    except Exception as error:
        rows = [row for row in snapshot['locations'] if row['sourceId'] == SOURCE_ID]
        previous = next((source for source in snapshot['sources'] if source['id'] == SOURCE_ID), None)
        source = dict(id=SOURCE_ID, name='South Carolina November 2026 early-voting centers',
                      dataset=PAGE, publisherPage=PAGE, records=len(rows), retrievedAt=retrieved,
                      lastSuccessfulAt=(previous or {}).get('retrievedAt') if rows else None,
                      coverageNote=NOTE, status='stale_retained' if rows else 'error', error=str(error))
        print(f'{SOURCE_ID}: {error}; retained {len(rows)} prior rows')
    snapshot['sources'] = [source for source in snapshot['sources'] if source['id'] != SOURCE_ID] + [source]
    snapshot['locations'] = [row for row in snapshot['locations'] if row['sourceId'] != SOURCE_ID] + rows
    snapshot['retrievedAt'] = retrieved
    snapshot['coverageNote'] = ('Official-source site-type records for NY, DC, MD, PA, NC, WA and SC. '
                                'South Carolina 2026 general-election early-vote centers have published dates and hours but no coordinates. '
                                'Other coverage is dated or incomplete. Verify current site status with election officials.')
    temp = SNAPSHOT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    temp.replace(SNAPSHOT)
    print(f'Wrote {len(snapshot["locations"])} voting-site rows')


if __name__ == '__main__':
    main()
