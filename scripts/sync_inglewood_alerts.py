"""Retrieve bounded official Inglewood alert listings for SoFi event context."""
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.cityofinglewood.org'
CATEGORIES = {
    'traffic': ('Traffic-Alert-10', 'Inglewood, CA - Alert Center - Traffic Alert'),
    'police': ('Police-8', 'Inglewood, CA - Alert Center - Police'),
    'emergency': ('Emergency-Services-12', 'Inglewood, CA - Alert Center - Emergency Services'),
}


def feed_url(category):
    return f'{BASE}/RSSFeed.aspx?CID={CATEGORIES[category][0]}&ModID=63'


def parse_feed(raw, category):
    if not raw or len(raw) > 200_000 or not raw.lstrip().startswith(b'<?xml'):
        raise ValueError('Alert feed empty, oversized, or not XML')
    root = ET.fromstring(raw)
    channel = root.find('channel') if root.tag == 'rss' else None
    if root.attrib.get('version') != '2.0' or channel is None or channel.findtext('title') != CATEGORIES[category][1]:
        raise ValueError('Unexpected Inglewood alert category')
    items = channel.findall('item')
    if len(items) > 50:
        raise ValueError('Alert listing unexpectedly large')
    result = []
    for item in items[:8]:
        link = (item.findtext('link') or '').strip()
        parsed = urlparse(link)
        if parsed.scheme != 'https' or parsed.hostname != 'www.cityofinglewood.org' or parsed.path.lower() != '/alertcenter.aspx' or not re.fullmatch(r'AID=\d{1,9}', parsed.query):
            continue
        aid = int(parsed.query.split('=', 1)[1])
        title = ' '.join((item.findtext('title') or '').split())[:180]
        description = ' '.join((item.findtext('description') or '').split())[:280]
        if not title:
            continue
        # The public demo avoids copying incident-level names or descriptions from police/emergency notices.
        if category != 'traffic':
            result.append({'id': aid, 'sourceUrl': link})
        else:
            result.append({'id': aid, 'title': title, 'description': description, 'sourcePublicationText': (item.findtext('pubDate') or '').strip()[:80], 'sourceUrl': link})
    return {'sourceUrl': feed_url(category), 'sourceBuildText': (channel.findtext('lastBuildDate') or '').strip()[:80], 'listedCount': len(items), 'entries': result}


def fetch_feed(category):
    url = feed_url(category)
    cmd = ['curl', '--fail', '--silent', '--show-error', '--location', '--max-redirs', '2', '--proto-redir', '=https', '--compressed', '--max-time', '20', '--write-out', '\n__EA_META__%{http_code} %{url_effective}', '--header', 'User-Agent: EventAtlas/0.4 official-city-alerts', url]
    response = subprocess.run(cmd, capture_output=True, timeout=25, check=True)
    raw, marker, metadata = response.stdout.rpartition(b'\n__EA_META__')
    if not marker:
        raise ValueError('Alert response lacks metadata')
    code, effective = metadata.decode('utf-8', 'replace').split(' ', 1)
    parsed = urlparse(effective)
    if code != '200' or parsed.scheme != 'https' or parsed.hostname != 'www.cityofinglewood.org' or parsed.path.lower() != '/rssfeed.aspx' or parsed.query != urlparse(url).query:
        raise ValueError('Unexpected alert feed response')
    return parse_feed(raw, category)


def main():
    categories, errors = {}, {}
    for category in CATEGORIES:
        try:
            categories[category] = fetch_feed(category)
        except Exception as error:
            errors[category] = str(error)[:120]
    result = {'schema': 'event-atlas.inglewood-alerts.v1', 'status': 'ok' if len(categories) == 3 else 'partial' if categories else 'unavailable', 'checkedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), 'venueId': '7065', 'categories': categories, 'errors': errors, 'interpretation': 'City-published alert listings. Feed presence or absence is not a complete police or emergency incident picture. Listing text has no verified stadium geometry or game impact; publication dates and category listing do not establish an active condition at kickoff.'}
    (ROOT / 'site/inglewood_alerts.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f"Inglewood alert categories: {result['status']}; {len(categories)}/3 checked; {sum(len(v['entries']) for v in categories.values())} bounded entries")


if __name__ == '__main__':
    main()
