"""Capture bounded, exact-game claims from the Rams' official Bills guide."""
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.therams.com/news/know-before-you-go-rams-vs-buffalo-bills-at-sofi-stadium-week-5'
CLAIMS = [
    ('pregame_performance', 'program', r'Pregame Performance\s*: During pregame, .*?TWO FRIENDS.*?will perform for fans', 'Rams announce TWO FRIENDS for a pregame performance; execution is unverified.', []),
    ('anthem', 'announced_person', r'National Anthem\s*: .*?MORGAN ST\. JEAN will perform the National Anthem', 'Rams announce Morgan St. Jean for the national anthem; appearance is unverified.', ['Morgan St. Jean']),
    ('halftime', 'announced_person', r'Halftime Performance\s*: Halftime will feature a performance from .*?JOJO', 'Rams announce JoJo for halftime; appearance is unverified.', ['JoJo']),
    ('third_quarter', 'announced_person', r'In-Game Performer\s*: TIMMY TRUMPET.*?will perform during the third quarter', 'Rams announce Timmy Trumpet for the third quarter; appearance is unverified.', ['Timmy Trumpet']),
    ('legend', 'announced_person', r'Legend of the Game Presented by 1800 Tequila\s*: Rams Legend DARIOUS WILLIAMS will be honored', 'Rams announce Darious Williams as Legend of the Game; appearance is unverified.', ['Darious Williams']),
    ('military_hero', 'announced_person', r'Military Hero of the Game Presented by Verizon\s*: Lieutenant Colonel Megan Harencak will be recognized during the third quarter', 'Rams announce recognition of Lt. Col. Megan Harencak in the third quarter; appearance is unverified.', ['Megan Harencak']),
    ('nonprofit_legend', 'announced_person', r'Hyundai Hope on Wheels\s*: During pregame, .*?Rams Legend Andrew Whitworth', 'Rams announce Andrew Whitworth in a pregame nonprofit recognition; appearance is unverified.', ['Andrew Whitworth']),
    ('early_entry', 'operations', r'Early Entry Special\s*: .*?from 3:15 p\.m\. - 4:15 p\.m\. PT', 'Rams publish an early-entry activity window of 3:15–4:15 p.m. PT; actual operation is unverified.', []),
    ('plaza_activities', 'operations', r'American Airlines Plaza Activities\s*: .*?from 3:15 p\.m\. - 5:15 p\.m\. PT', 'Rams publish an Upper American Airlines Plaza activity window of 3:15–5:15 p.m. PT; actual operation is unverified.', []),
    ('registration_activation', 'program', r'NFL Votes\s*: Voter registration booths .*?from 3:15 p\.m\. – 5:15 p\.m\. PT on gameday', 'Rams announce NFL Votes voter-registration booths from 3:15–5:15 p.m. PT. These are not published polling places; activation is unverified.', []),
]


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'noscript'}:
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'noscript'} and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def parse_page(raw):
    if not raw or len(raw) > 1_000_000 or b'<html' not in raw[:500].lower():
        raise ValueError('Rams guide is empty, oversized, or not HTML')
    parser = VisibleText()
    parser.feed(raw.decode('utf-8', 'replace'))
    body = ' '.join(' '.join(parser.parts).split())
    if not 1000 <= len(body) <= 100_000 or not re.search(r'Know Before You Go: Rams vs\. Buffalo Bills at SoFi Stadium', body, re.I) or not re.search(r'Monday, October 12 at 5:15 p\.m\. PT', body):
        raise ValueError('Rams guide no longer identifies the exact game, venue and time')
    return body


def extract(body, now):
    claims, missing = [], []
    section = body.split('RAMS GAMEDAY TO FEATURE SPECIAL MOMENTS AND PERFORMANCES', 1)[1].split('Related Content', 1)[0] if 'RAMS GAMEDAY TO FEATURE SPECIAL MOMENTS AND PERFORMANCES' in body else ''
    for claim_id, category, pattern, summary, names in CLAIMS:
        match = re.search(pattern, section, re.I)
        if not match:
            missing.append(claim_id)
            continue
        claims.append({'id': claim_id, 'category': category, 'summary': summary, 'names': names, 'sourceUrl': URL, 'sourceTextSha256': hashlib.sha256(match.group(0).encode()).hexdigest()})
    return {'schema': 'event-atlas.rams-bills-gameday.v1', 'status': 'ok' if not missing else 'partial' if claims else 'failed', 'checkedAt': now.isoformat().replace('+00:00', 'Z'), 'gameId': 'nfl:401872994', 'venueId': '7065', 'eventDate': '2026-10-12', 'sourceUrl': URL, 'sourcePublicationText': 'Oct 09, 2026 at 09:00 AM; publisher time zone not supplied', 'claims': claims, 'missingClaimIds': missing, 'interpretation': 'Club-published event plans and named roles. Activity execution, identity at venue, protective status and attendance are unverified. The NFL Votes activation is voter registration, not a polling place.'}


def main():
    command = ['curl', '--fail', '--silent', '--show-error', '--location', '--max-redirs', '2', '--proto-redir', '=https', '--compressed', '--max-time', '25', '--write-out', '\n__EA_META__%{http_code} %{url_effective}', '--header', 'User-Agent: EventAtlas/0.4 official-game-guide', URL]
    try:
        response = subprocess.run(command, capture_output=True, timeout=30, check=True)
        raw, marker, metadata = response.stdout.rpartition(b'\n__EA_META__')
        if not marker:
            raise ValueError('Guide response lacks metadata')
        status, effective = metadata.decode('utf-8', 'replace').split(' ', 1)
        final = urlparse(effective)
        if status != '200' or final.scheme != 'https' or final.hostname != 'www.therams.com' or final.path != urlparse(URL).path:
            raise ValueError(f'Unexpected guide response: HTTP {status}')
        output = extract(parse_page(raw), datetime.now(timezone.utc))
    except Exception as error:
        output = extract('', datetime.now(timezone.utc))
        print(f'Rams guide unavailable: {str(error)[:120]}')
    (ROOT / 'site/rams_bills_gameday.json').write_text(json.dumps(output, separators=(',', ':')) + '\n')
    print(f"Rams–Bills guide: {output['status']}; {len(output['claims'])}/{len(CLAIMS)} bounded claims checked")


if __name__ == '__main__':
    main()
