import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublishedChangeFeed,renderPublishedChangeAtom} from '../lib/published_change_feed.mjs';

const now=Date.parse('2026-10-10T04:00:00Z');
const report={eventId:'nfl:123',title:'Bears at Packers',path:'reports/nfl-123.html'};
const change={kind:'newly_displayed_cue',title:'NWS <alert> & update',detail:'Source says "review"',observedAt:'2026-10-10T03:00:00Z',sourceUrl:'https://api.weather.gov/alerts/123'};
const state={schema:'event-atlas.published-report-state.v6',eventId:'nfl:123',changes:[change,change,{...change,sourceUrl:'http://example.com/insecure'},{...change,observedAt:'2026-09-20T03:00:00Z'}]};

test('change subscription deduplicates bounded recent entries and escapes Atom text',()=>{
  const feed=buildPublishedChangeFeed([report],[state],now);
  assert.equal(feed.items.length,1);
  assert.equal(feed.items[0].status,'unreviewed_source_change');
  assert.equal(feed.items[0].reportUrl,'https://redxking.github.io/event-atlas-nfl-demo/reports/nfl-123.html');
  const atom=renderPublishedChangeAtom(feed);
  assert.match(atom,/<title>Bears at Packers: NWS &lt;alert&gt; &amp; update<\/title>/);
  assert.match(atom,/rel="related" href="https:\/\/api.weather.gov\/alerts\/123"/);
  assert.doesNotMatch(atom,/example.com/);
  assert.match(atom,/Unreviewed source change/);
});

test('unmatched states and missing source links do not enter the subscription',()=>{
  const feed=buildPublishedChangeFeed([report],[{...state,eventId:'nfl:other'},{...state,changes:[{...change,sourceUrl:null}]}],now);
  assert.equal(feed.items.length,0);
});

test('recent coverage churn cannot crowd out a substantive source revision from the Atom feed',()=>{
  const substantive={...change,kind:'city_regional_notice_revised',title:'Lakefront festival hours revised',observedAt:'2026-10-09T20:00:00Z'};
  const coverage=Array.from({length:120},(_,index)=>({...change,kind:'source_status_changed',title:`Coverage transition ${index}`,observedAt:new Date(Date.parse('2026-10-10T01:00:00Z')+index*60000).toISOString()}));
  const reports=Array.from({length:5},(_,index)=>({...report,eventId:`nfl:${123+index}`,path:`reports/nfl-${123+index}.html`}));
  const states=reports.map((item,index)=>({...state,eventId:item.eventId,changes:[...coverage.slice(index*24,(index+1)*24),...(index===0?[substantive]:[])]}));
  const feed=buildPublishedChangeFeed(reports,states,now);
  assert.equal(feed.items.filter(item=>item.kind==='source_status_changed').length,30);
  assert.equal(feed.items.find(item=>item.kind==='city_regional_notice_revised')?.title,substantive.title);
  assert.match(renderPublishedChangeAtom(feed),/Lakefront festival hours revised/);
});
