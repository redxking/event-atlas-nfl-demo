"""Import Florida's county PDFs for the November 2026 General Election."""
import hashlib
import io
import json
import re
import subprocess
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'data/voting_locations.json'
SOURCE_EARLY = 'fl-early-general-2026'
SOURCE_INTAKE = 'fl-intake-general-2026'
PAGE = 'https://dos.fl.gov/elections/for-voters/voting/early-voting-and-secure-ballot-intake-stations/'
ZIP_URL = 'https://dos.fl.gov/media/711428/20261002-ev-and-secure-ballot-intake-station-locations-2026-ge.zip'
NOTE_EARLY = ('Florida Division of Elections county PDF early-voting locations for the 2026 General Election. '
              'Published schedule and intake-station indicator are source claims; some addresses are incomplete. '
              'Verify current operation and location with the county Supervisor of Elections.')
NOTE_INTAKE = ('Florida Division of Elections county PDF additional secure ballot intake stations marked for the '
               '2026 General Election. Two Alachua rows include dates and hours in the name cell; most rows have no hours. '
               'Verify current operation with the county Supervisor of Elections.')


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def digest(*parts):
    return hashlib.sha256('|'.join(parts).encode()).hexdigest()[:20]


def fetch_zip():
    result = subprocess.run(['curl', '-fLsS', '--max-time', '60', '-A', 'Mozilla/5.0',
                             '-e', PAGE, ZIP_URL], capture_output=True, check=True)
    return result.stdout


def county_name(code, first_page):
    lines = [clean(line) for line in (first_page.extract_text() or '').splitlines()]
    if len(lines) < 3 or 'Early Voting Locations' not in lines[0] or 'General Election' not in lines[1].title():
        raise ValueError(f'Florida PDF title/election changed: {code}: {lines[:3]}')
    county = re.sub(r'\s+county$', '', lines[2].strip('[]').strip(), flags=re.I)
    overrides = {'DAD': 'Miami-Dade', 'DES': 'DeSoto', 'STJ': 'St. Johns'}
    return overrides.get(code, county.title())


def parse_date(value):
    for pattern in ('%B %d, %Y', '%m/%d/%Y'):
        try:
            return datetime.strptime(clean(value), pattern).date().isoformat()
        except ValueError:
            pass
    return None


def parse_time(value):
    match = re.fullmatch(r'(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?', clean(value), re.I)
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2) or '0')
    if not 1 <= hour <= 12 or not 0 <= minute <= 59:
        return None
    return f'{hour}:{minute:02d} {match.group(3).upper()}M'


def parse_schedule(table, header_idx, code):
    header = [clean(value).lower() for value in table[header_idx]]
    start_col = next((i for i, value in enumerate(header) if value == 'start time'), None)
    end_col = next((i for i, value in enumerate(header) if value == 'end time'), None)
    if start_col is None or end_col is None:
        raise ValueError(f'Florida {code} schedule columns changed')
    series = []
    anomalies = []
    holmes_date = datetime(2026, 10, 24).date()
    for row in table[header_idx + 1:]:
        if len(row) <= max(start_col, end_col):
            continue
        label = clean(row[0])
        if not re.match(r'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)', label):
            continue
        start, end = clean(row[start_col]), clean(row[end_col])
        if start.upper() in ('', 'N/A', 'NA') and end.upper() in ('', 'N/A', 'NA'):
            continue
        normalized_start, normalized_end = parse_time(start), parse_time(end)
        if not normalized_start or not normalized_end:
            raise ValueError(f'Florida {code} invalid day hours: {label}: {start}–{end}')
        date = parse_date(row[1])
        if code == 'HOL' and not date:
            date = holmes_date.isoformat()
            holmes_date += timedelta(days=1)
        if not date or not ('2026-10-19' <= date <= '2026-11-01'):
            anomalies.append(f'{label}: {clean(row[1])} {normalized_start}–{normalized_end}; date not used')
            continue
        series.append(dict(dates=date, hours=f'{normalized_start}–{normalized_end}'))
    if not series or len({item['dates'] for item in series}) != len(series):
        raise ValueError(f'Florida {code} incomplete or duplicated schedule: {len(series)} days')
    return series, anomalies


def site_row(table, header_idx, code):
    prior = table[:header_idx]
    headers = [i for i, row in enumerate(prior) if len(row) > 2 and clean(row[0]) in ('Location Name', 'Location Name') and clean(row[2]) == 'Address']
    if headers:
        candidate = prior[headers[-1] + 1]
    else:
        candidate = next((row for row in prior if len(row) > 2 and clean(row[0]) and clean(row[1]) and clean(row[2])
                          and not clean(row[0]).startswith('Location ')), None)
    if candidate is None:
        raise ValueError(f'Florida {code} site table has no candidate row')
    return candidate


def common(source_id, county, name, address, retrieved, source_file, page):
    postal = re.search(r'(?<!\d)(\d{5})(?!\d)', address)
    key = digest(county, name, address)
    return dict(id=f'{source_id}:{key}', sourceId=source_id, sourceRecordId=key,
                name=name, jurisdiction='FL', county=county, city='', street=address,
                addressLine2='', postal=postal.group(1) if postal else '', lat=None, lon=None,
                precinct=None, ward='', votingSpace='', accessibility='', sourceUrl=ZIP_URL,
                sourceRecordUrl=ZIP_URL, sourceFile=source_file, sourcePage=page,
                retrievedAt=retrieved, sourceEditedAt=None,
                coordinateStatus='Not published in county PDF')


def parse_early(table, code, county, retrieved, source_file, page):
    header_idx = next((i for i, row in enumerate(table) if clean(row[0]) == 'Days of Operation'), None)
    if header_idx is None:
        return None
    row = site_row(table, header_idx, code)
    name, category, address = (clean(value) for value in row[:3])
    if not address and not name:
        return 'blank'
    location_label = next((clean(prior[0]) for prior in table[:header_idx] if re.fullmatch(r'Location \d+', clean(prior[0]))), '')
    if not name:
        name = location_label or f'{county} published early-voting location'
    if not address:
        raise ValueError(f'Florida {code} named early-voting location lacks address: {name}')
    tz = clean(row[-2]).title()
    if tz not in ('Eastern', 'Central'):
        raise ValueError(f'Florida {code} invalid time zone: {name}: {tz}')
    schedule, anomalies = parse_schedule(table, header_idx, code)
    intake = clean(row[-1])
    if intake not in ('Yes', '', 'SAME LOCATION'):
        raise ValueError(f'Florida {code} intake indicator changed: {name}: {intake}')
    result = common(SOURCE_EARLY, county, name, address, retrieved, source_file, page)
    result.update(type='early_vote_center', status='Published for November 3, 2026 General Election early voting',
                  datesOpen=f"{schedule[0]['dates']}–{schedule[-1]['dates']}", hours='See published schedule',
                  schedule=schedule, timeZone=f'America/{"Chicago" if tz == "Central" else "New_York"}',
                  facilityClass=category, sourceLocationLabel=location_label,
                  sourceScheduleAnomalies=anomalies,
                  secureBallotIntakePublished=intake or 'Not stated', sourceDataStatus=NOTE_EARLY)
    return result


def parse_other(table, code, county, retrieved, source_file, page):
    if not clean(table[0][0]).startswith('Other Secure Ballot Intake'):
        return []
    header_idx = next((i for i, row in enumerate(table) if any('General' in clean(value) and 'Election' in clean(value) for value in row)), None)
    if header_idx is None:
        raise ValueError(f'Florida {code} additional intake table lacks election columns')
    general_col = next(i for i, value in enumerate(table[header_idx]) if 'General' in clean(value) and 'Election' in clean(value))
    results = []
    for row in table[header_idx + 1:]:
        if len(row) <= general_col or len(row) < 3:
            continue
        name, category, address = (clean(value) for value in row[:3])
        if not name and not address:
            continue
        if not name or not address:
            raise ValueError(f'Florida {code} incomplete additional intake row')
        marker = clean(row[general_col])
        if not marker:
            continue
        if marker not in ('\uf0fc', 'Yes'):
            raise ValueError(f'Florida {code} unexpected General Election marker: {marker}')
        result = common(SOURCE_INTAKE, county, name, address, retrieved, source_file, page)
        embedded = re.search(r'(\d{2}/\d{2}/2026)\s*\(([^)]+)\)', name)
        date = parse_date(embedded.group(1)) if embedded else None
        times = embedded.group(2).split('-', 1) if embedded else []
        hours = ''
        if date and len(times) == 2:
            start, end = parse_time(times[0]), parse_time(times[1])
            if start and end:
                hours = f'{start}–{end}'
        result.update(type='secure_ballot_intake_station',
                      status='Marked for November 3, 2026 General Election',
                      datesOpen=date or '', hours=hours, facilityClass=category,
                      sourceDataStatus=NOTE_INTAKE)
        results.append(result)
    return results


def parse_zip(data, retrieved):
    early, intake = [], []
    blank_templates = 0
    site_tables = 0
    other_tables = 0
    counties = set()
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        files = [name for name in archive.namelist() if name.lower().endswith('.pdf')]
        if len(files) != 67:
            raise ValueError(f'Florida county PDF count changed: {len(files)}')
        for source_file in files:
            code = source_file.split(' ', 1)[0]
            with pdfplumber.open(io.BytesIO(archive.read(source_file))) as pdf:
                county = county_name(code, pdf.pages[0])
                counties.add(county)
                county_sites = 0
                for page_number, page in enumerate(pdf.pages, 1):
                    for table in page.extract_tables():
                        if any(clean(row[0]) == 'Days of Operation' for row in table):
                            site_tables += 1
                            item = parse_early(table, code, county, retrieved, source_file, page_number)
                            if item == 'blank':
                                blank_templates += 1
                            elif item:
                                early.append(item)
                                county_sites += 1
                        elif clean(table[0][0]).startswith('Other Secure Ballot Intake'):
                            other_tables += 1
                            intake.extend(parse_other(table, code, county, retrieved, source_file, page_number))
                if county_sites == 0:
                    raise ValueError(f'Florida {code} has no usable early-voting site')
    if len(counties) != 67 or site_tables != 467 or blank_templates != 3 or len(early) != 464 or other_tables != 25 or len(intake) != 66:
        raise ValueError(f'Florida source shape changed: {len(counties)} counties, {site_tables} tables, '
                         f'{blank_templates} blanks, {len(early)} early sites, {other_tables} intake tables, {len(intake)} intake rows')
    for group in (early, intake):
        if len({row['id'] for row in group}) != len(group):
            raise ValueError('Florida source-derived IDs are not unique')
    return early, intake


def main():
    snapshot = json.loads(SNAPSHOT.read_text())
    retrieved = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    try:
        data = fetch_zip()
        early, intake = parse_zip(data, retrieved)
        rows = early + intake
        source_digest = hashlib.sha256(data).hexdigest()
        sources = [dict(id=source_id, name=name, dataset=ZIP_URL, publisherPage=PAGE,
                        records=len(group), reportedCount=len(group), retrievedAt=retrieved,
                        dataEditedAt=None, sourceDigest=source_digest, coverageNote=note, status='ok')
                   for source_id, name, group, note in (
                       (SOURCE_EARLY, 'Florida November 2026 early-voting sites', early, NOTE_EARLY),
                       (SOURCE_INTAKE, 'Florida November 2026 additional ballot intake stations', intake, NOTE_INTAKE))]
        print(f'Florida: {len(early)} early-voting sites and {len(intake)} additional intake-station rows across 67 counties')
    except Exception as error:
        rows = [row for row in snapshot['locations'] if row['sourceId'] in (SOURCE_EARLY, SOURCE_INTAKE)]
        sources = []
        for source_id, name, note in (
            (SOURCE_EARLY, 'Florida November 2026 early-voting sites', NOTE_EARLY),
            (SOURCE_INTAKE, 'Florida November 2026 additional ballot intake stations', NOTE_INTAKE)):
            prior = next((source for source in snapshot['sources'] if source['id'] == source_id), None)
            count = sum(row['sourceId'] == source_id for row in rows)
            sources.append(dict(id=source_id, name=name, dataset=ZIP_URL, publisherPage=PAGE,
                                records=count, retrievedAt=retrieved,
                                lastSuccessfulAt=(prior or {}).get('retrievedAt') if count else None,
                                coverageNote=note, status='stale_retained' if count else 'error', error=str(error)))
        print(f'Florida: {error}; retained {len(rows)} prior rows')
    snapshot['sources'] = [s for s in snapshot['sources'] if s['id'] not in (SOURCE_EARLY, SOURCE_INTAKE)] + sources
    snapshot['locations'] = [r for r in snapshot['locations'] if r['sourceId'] not in (SOURCE_EARLY, SOURCE_INTAKE)] + rows
    snapshot['retrievedAt'] = retrieved
    snapshot['coverageNote'] = ('Official-source site-type records for NY, DC, MD, PA, NC, WA, SC, WV, DE and FL. '
                                'Election-specific scope varies. Verify current site status with election officials.')
    temp = SNAPSHOT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    temp.replace(SNAPSHOT)
    print(f'Wrote {len(snapshot["locations"])} voting-site rows')


if __name__ == '__main__':
    main()
