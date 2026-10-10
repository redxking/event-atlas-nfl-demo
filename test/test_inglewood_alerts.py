import unittest
from scripts.sync_inglewood_alerts import parse_feed


class InglewoodAlertFeedTest(unittest.TestCase):
    def xml(self, category_title, item=''):
        return (f'<?xml version="1.0"?><rss version="2.0"><channel><title>{category_title}</title><lastBuildDate>Sat, 10 Oct 2026 09:46:04 -0800</lastBuildDate>{item}</channel></rss>').encode()

    def test_traffic_notice_keeps_bounded_source_text(self):
        item='<item><title>Traffic Alert Issue 10/10/26</title><link>https://www.cityofinglewood.org/AlertCenter.aspx?AID=1872</link><pubDate>Tue, 06 Oct 2026 08:22:48 -0800</pubDate><description>City event; expect delays.</description></item>'
        feed=parse_feed(self.xml('Inglewood, CA - Alert Center - Traffic Alert', item), 'traffic')
        self.assertEqual(feed['listedCount'],1)
        self.assertEqual(feed['entries'][0]['id'],1872)
        self.assertIn('expect delays',feed['entries'][0]['description'])

    def test_police_item_omits_name_and_description(self):
        item='<item><title>Named private person</title><link>https://www.cityofinglewood.org/AlertCenter.aspx?AID=7</link><description>Private details</description></item>'
        feed=parse_feed(self.xml('Inglewood, CA - Alert Center - Police', item), 'police')
        self.assertEqual(feed['entries'],[{'id':7,'sourceUrl':'https://www.cityofinglewood.org/AlertCenter.aspx?AID=7'}])

    def test_wrong_category_fails_closed(self):
        with self.assertRaises(ValueError):
            parse_feed(self.xml('Other city alerts'),'traffic')


if __name__ == '__main__':
    unittest.main()
