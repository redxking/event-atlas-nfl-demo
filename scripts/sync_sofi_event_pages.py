"""Capture exact SoFi Stadium event-page timing without resolving publisher conflicts."""
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
EVENTS = (
    ('nfl:401872989', 'chargers-broncos-2026', 'Chargers vs. Broncos', 'Oct. 11, 2026', '1:05 PM'),
    ('nfl:401872994', 'rams-bills-2026', 'Rams vs. Bills', 'Oct. 12, 2026', '5:15 PM'),
)


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript') and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def parse_event(raw, event):
    game_id, slug, title, date_text, expected_start = event
    if not raw or len(raw) > 350_000 or b'<html' not in raw[:500].lower():
        raise ValueError('Event page empty, oversized, or not HTML')
    parser = VisibleText()
    parser.feed(raw.decode('utf-8', 'replace'))
    body = ' '.join(' '.join(parser.parts).split())
    if not 500 <= len(body) <= 80_000 or title not in body or not re.search(date_text.replace(' ', r'\s*').replace(',', r'\s*,'), body):
        raise ValueError('Event page identity changed')
    sidebar = body.split('Event Starts', 1)[1].split('Availability', 1)[0] if 'Event Starts' in body else ''
    if not re.search(r'\b' + re.escape(expected_start) + r'\b', sidebar):
        raise ValueError('Event page sidebar kickoff no longer matches the official game')
    details = body.split('Event Details', 1)[1].split('How do I get to SoFi Stadium?', 1)[0] if 'Event Details' in body else ''
    values = {}
    for key, label in [('parkingLotsOpenLocal', 'Parking Lots Open'), ('doorsOpenLocal', 'Doors Open'), ('detailKickoffLocal', 'Kick Off')]:
        match = re.search(re.escape(label) + r'\s*:\s*(TBD|\d{1,2}:\d{2}\s*[AP]M)\b', details, re.I)
        if not match:
            raise ValueError(f'Event detail {label} missing or changed')
        values[key] = 'TBD' if match.group(1).upper() == 'TBD' else re.sub(r'\s+', ' ', match.group(1).upper())
    excerpt = ' '.join((title, date_text, expected_start, details))
    return {'gameId': game_id, 'sourceUrl': f'https://www.sofistadium.com/events/detail/{slug}', 'eventDateText': date_text, 'eventStartsLocal': expected_start, **values, 'detailKickoffConflictsWithSidebar': values['detailKickoffLocal'] not in ('TBD', expected_start), 'sourceTextSha256': hashlib.sha256(excerpt.encode()).hexdigest()}


def fetch_event(event):
    url = f'https://www.sofistadium.com/events/detail/{event[1]}'
    cmd = ['curl', '--fail', '--silent', '--show-error', '--location', '--max-redirs', '2', '--proto-redir', '=https', '--compressed', '--max-time', '20', '--write-out', '\n__EA_META__%{http_code} %{url_effective}', '--header', 'User-Agent: EventAtlas/0.4 official-venue-event', url]
    response = subprocess.run(cmd, capture_output=True, timeout=25, check=True)
    raw, marker, metadata = response.stdout.rpartition(b'\n__EA_META__')
    if not marker:
        raise ValueError('Venue page lacks response metadata')
    code, effective = metadata.decode('utf-8', 'replace').split(' ', 1)
    final = urlparse(effective)
    if code != '200' or final.scheme != 'https' or final.hostname != 'www.sofistadium.com' or final.path != urlparse(url).path:
        raise ValueError('Venue page redirected or returned unexpected status')
    return parse_event(raw, event)


def main():
    pages, errors = {}, {}
    for event in EVENTS:
        try:
            pages[event[0]] = fetch_event(event)
        except Exception as error:
            errors[event[0]] = str(error)[:120]
    result = {'schema': 'event-atlas.sofi-event-pages.v1', 'status': 'ok' if len(pages) == len(EVENTS) else 'partial' if pages else 'unavailable', 'checkedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'), 'venueId': '7065', 'pages': pages, 'errors': errors, 'interpretation': 'Venue-published event details. Opening times are plans, not observed operations. Any kickoff discrepancy requires publisher confirmation; it is not an incident or threat finding.'}
    (ROOT / 'site/sofi_event_pages.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f"SoFi exact-game pages: {result['status']}; {len(pages)}/{len(EVENTS)} parsed; {sum(page['detailKickoffConflictsWithSidebar'] for page in pages.values())} internal kickoff conflicts")


if __name__ == '__main__':
    main()
