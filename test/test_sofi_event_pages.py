import unittest
from scripts.sync_sofi_event_pages import EVENTS, parse_event


class SofiEventPageTest(unittest.TestCase):
    def html(self, event, start, parking, doors, detail):
        _, _, title, date, _ = event
        month, day, year = date.split(' ')
        return (f'<html><body><h1>{title}</h1><p>Date {month} {day[:-1]} , {year}</p>'
                f'<div>Event Starts {start} Availability On Sale Now</div>'
                f'<h2>Event Details</h2><p>Parking Lots Open: {parking}</p>'
                f'<p>Doors Open: {doors}</p><p>Kick Off: {detail}</p>'
                f'<p>How do I get to SoFi Stadium?</p>{"Venue page context. " * 40}</body></html>').encode()

    def test_preserves_conflicting_venue_kickoff(self):
        event = EVENTS[0]
        page = parse_event(self.html(event, '1:05 PM', '9:00 AM', '11:00 AM', '1:35 PM'), event)
        self.assertTrue(page['detailKickoffConflictsWithSidebar'])
        self.assertEqual(page['doorsOpenLocal'], '11:00 AM')

    def test_wrong_sidebar_or_missing_detail_fails_closed(self):
        event = EVENTS[0]
        with self.assertRaises(ValueError):
            parse_event(self.html(event, '1:25 PM', '9:00 AM', '11:00 AM', '1:35 PM'), event)
        with self.assertRaises(ValueError):
            parse_event(self.html(event, '1:05 PM', '9:00 AM', 'unknown', '1:35 PM'), event)


if __name__ == '__main__':
    unittest.main()
