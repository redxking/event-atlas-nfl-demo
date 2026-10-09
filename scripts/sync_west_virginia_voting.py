"""Import the WV Secretary of State's 2026 general early-voting locations."""
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/voting_locations.json'
SOURCE_ID = 'wv-early-general-2026'
PAGE = 'https://sos.wv.gov/early-voting-locations'
NOTE = ('West Virginia Secretary of State 2026 general-election early-voting list. '
        'County-specific hours and per-site dates are preserved; no source coordinates. '
        'Confirm any change or current operation with the county clerk.')


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def parse(data, retrieved):
    document = html.fromstring(data)
    page_text = clean(document.text_content())
    if 'Early Voting Dates: October 21–31, 2026' not in page_text:
        raise ValueError('West Virginia election date text changed')
    tables = document.xpath('//table[.//th[contains(.,"Location Name")]]')
    if len(tables) != 1:
        raise ValueError('West Virginia site table changed')
    trs = tables[0].xpath('.//tr')
    rows = []
    counties = set()
    for index, tr in enumerate(trs):
        cells = tr.xpath('./th|./td')
        if len(cells) != 7 or clean(cells[0].text_content()) == 'County':
            continue
        values = [clean(cell.text_content()) for cell in cells]
        county, category, name, address, phone, weekday, saturday = values
        if not county.startswith('County') or category not in ('Main', 'Satellite'):
            raise ValueError(f'West Virginia county/type changed: {values}')
        county = county.removeprefix('County').strip()
        name = name.removeprefix('Location').strip()
        address = address.removeprefix('Address').strip()
        phone = phone.removeprefix('Phone').strip()
        weekday = weekday.removeprefix('Mon–Fri').strip()
        saturday = saturday.removeprefix('Saturday').strip()
        match = re.search(r'\bWV\s+(\d{5})\b', address)
        next_cells = trs[index + 1].xpath('./th|./td') if index + 1 < len(trs) else []
        note = clean(next_cells[0].text_content()) if len(next_cells) == 1 else ''
        date_match = re.fullmatch(r'🗓 Open: Oct\. (21|27)–31, 2026', note)
        if not all((county, name, address, phone, weekday, saturday, match, date_match)):
            raise ValueError(f'West Virginia site fields or dates changed: {values}; {note}')
        dates = f'October {date_match.group(1)}–31, 2026'
        digest = hashlib.sha256('|'.join((county, category, name, address)).encode()).hexdigest()[:20]
        counties.add(county)
        rows.append(dict(id=f'{SOURCE_ID}:{digest}', sourceId=SOURCE_ID, sourceRecordId=digest,
                         name=name, type='early_vote_center', jurisdiction='WV', county=county,
                         city='', street=address, addressLine2='', postal=match.group(1),
                         lat=None, lon=None, precinct=None, ward='',
                         status='Published for November 3, 2026 General Election early voting',
                         datesOpen=dates, hours=f'Mon–Fri {weekday}; Saturday {saturday}',
                         siteCategory=category, contactPhone=phone,
                         votingSpace='', accessibility='', sourceUrl=PAGE, sourceRecordUrl=PAGE,
                         sourceDataStatus=NOTE, retrievedAt=retrieved, sourceEditedAt=None,
                         coordinateStatus='Not published on source page'))
    if len(rows) != 99 or len(counties) != 55 or len({row['id'] for row in rows}) != len(rows):
        raise ValueError(f'West Virginia list changed: {len(rows)} sites, {len(counties)} counties')
    return rows, hashlib.sha256(data).hexdigest()


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    try:
        request = urllib.request.Request(PAGE, headers={'User-Agent': 'Mozilla/5.0 EventAtlas public-data evaluation'})
        with urllib.request.urlopen(request, timeout=30) as response:
            rows, digest = parse(response.read(), retrieved)
        source = dict(id=SOURCE_ID, name='West Virginia November 2026 early-voting locations',
                      dataset=PAGE, publisherPage=PAGE, records=len(rows), reportedCount=len(rows),
                      retrievedAt=retrieved, dataEditedAt=None, sourceDigest=digest,
                      coverageNote=NOTE, status='ok')
        print(f'{SOURCE_ID}: {len(rows)} sites across 55 counties')
    except Exception as error:
        rows = [row for row in snapshot['locations'] if row['sourceId'] == SOURCE_ID]
        previous = next((source for source in snapshot['sources'] if source['id'] == SOURCE_ID), None)
        source = dict(id=SOURCE_ID, name='West Virginia November 2026 early-voting locations',
                      dataset=PAGE, publisherPage=PAGE, records=len(rows), retrievedAt=retrieved,
                      lastSuccessfulAt=(previous or {}).get('retrievedAt') if rows else None,
                      coverageNote=NOTE, status='stale_retained' if rows else 'error', error=str(error))
        print(f'{SOURCE_ID}: {error}; retained {len(rows)} prior rows')
    snapshot['sources'] = [source for source in snapshot['sources'] if source['id'] != SOURCE_ID] + [source]
    snapshot['locations'] = [row for row in snapshot['locations'] if row['sourceId'] != SOURCE_ID] + rows
    snapshot['retrievedAt'] = retrieved
    snapshot['coverageNote'] = ('Official-source site-type records for NY, DC, MD, PA, NC, WA, SC and WV. '
                                'Election-specific scope varies. Verify current site status with election officials.')
    temp = SNAPSHOT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    temp.replace(SNAPSHOT)
    print(f'Wrote {len(snapshot["locations"])} voting-site rows')


if __name__ == '__main__':
    main()
