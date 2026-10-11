import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPublicReportHtml} from '../scripts/render_public_report_html.mjs';
import {newerReportRevision} from '../site/report_refresh.js';

test('published report HTML renders cited HTTPS links and escapes untrusted report text',()=>{
  const markdown='# Event <script>alert(1)</script>\n\n- **Source:** [NWS alert](https://api.weather.gov/alerts/123)\n- Publisher says <img src=x onerror=alert(1)>\n';
  const html=renderPublicReportHtml(markdown,{title:'Event report',generatedAt:'2026-10-10T00:00:00Z',markdownPath:'nfl-123.md',liveContext:{monitoringMode:'near_term_monitoring',gameId:'nfl:401872984',home:'Tennessee Titans',away:'Houston Texans',venueId:'3810',lat:38.9,lon:-76.8,kickoff:'2026-10-11T17:00:00Z',status:'scheduled'}});
  assert.ok(html.includes('<a href="https://api.weather.gov/alerts/123"'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('name="author" content="Angelis Pseftis"'));
  assert.ok(html.includes('data-report-path="reports/nfl-123.html"'));
  assert.ok(html.includes('report_refresh.js?v=20261010-1'));
  assert.match(html,/report_live_nws\.js\?v=[A-Za-z0-9-]+/);
  assert.ok(html.includes('report_live_nws_forecast.js?v=20261010-1'));
  assert.ok(html.includes('report_live_usgs.js?v=20261010-2'));
  assert.ok(html.includes('report_live_capture.js?v=20261010-2'));
  assert.ok(html.includes('id="capture-direct-observations"'));
  assert.ok(html.includes('report_live_nws_station.js?v=20261010-1'));
  assert.ok(html.includes('id="direct-nws-station"'));
  assert.ok(html.includes('report_live_game.js?v=20261010-1'));
  assert.ok(html.includes('report_live_tennessee_road.js?v=20261010-1'));
  assert.ok(html.includes('report_live_public_safety.js?v=20261010-2'));
  assert.ok(html.includes('data-venue-id="3810"'));
  assert.ok(html.includes('data-game-id="nfl:401872984" data-home="Tennessee Titans" data-away="Houston Texans"'));
  assert.ok(html.includes('id="direct-game"'));
  assert.ok(html.includes('id="direct-tennessee-road"'));
  assert.ok(html.includes('id="direct-public-safety"'));
  assert.ok(html.includes('data-venue-lat="38.9" data-venue-lon="-76.8"'));
  assert.ok(html.includes('id="direct-nws"'));
  assert.ok(html.includes('id="direct-nws-forecast"'));
  assert.ok(html.includes('id="direct-usgs"'));
  assert.throws(()=>renderPublicReportHtml(markdown,{title:'x',generatedAt:'x',markdownPath:'../other.md'}),/Invalid/);
});

test('published report refresh requires a unique newer matching revision',()=>{
  const at=Date.now()-60000,earlier=new Date(at-3600000).toISOString(),later=new Date(at).toISOString();
  const index={status:'ok',builtAt:later,reports:[{path:'reports/nfl-123.html',generatedAt:later}]};
  assert.equal(newerReportRevision(index,'reports/nfl-123.html',earlier),later);
  assert.equal(newerReportRevision(index,'reports/nfl-123.html',later),null);
  assert.equal(newerReportRevision(index,'reports/nfl-456.html',earlier),null);
  assert.equal(newerReportRevision({...index,reports:[...index.reports,...index.reports]},'reports/nfl-123.html',earlier),null);
  assert.equal(newerReportRevision(index,'../nfl-123.html',earlier),null);
});
