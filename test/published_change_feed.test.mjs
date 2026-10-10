import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublishedChangeFeed,renderPublishedChangeAtom} from '../lib/published_change_feed.mjs';

const now=Date.parse('2026-10-10T04:00:00Z');
const report={eventId:'nfl:123',title:'Bears at Packers',path:'reports/nfl-123.html'};
const change={kind:'newly_displayed_cue',title:'NWS <alert> & update',detail:'Source says "review"',observedAt:'2026-10-10T03:00:00Z',sourceUrl:'https://api.weather.gov/alerts/123'};
const state={schema:'event-atlas.published-report-state.v7',eventId:'nfl:123',changes:[change,change,{...change,sourceUrl:'http://example.com/insecure'},{...change,observedAt:'2026-09-20T03:00:00Z'}]};

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

test('current v8 published report states remain in the change subscription',()=>{
  const feed=buildPublishedChangeFeed([report],[{...state,schema:'event-atlas.published-report-state.v8'}],now);
  assert.equal(feed.items.length,1);
  assert.equal(feed.items[0].sourceUrl,change.sourceUrl);
});

test('shared regional records are retained when no source-change item was observed',()=>{
  const quake={sourceId:'ci41345415',sourceUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/ci41345415',title:'M 3.2 near Signal Hill',occurredAt:'2026-10-09T03:00:00Z',updatedAt:'2026-10-10T03:00:00Z',distanceKm:23,point:[-118.1845,33.7875]};
  const reports=[{...report,eventId:'nfl:1',kickoff:'2026-10-11T20:00:00Z',venueName:'SoFi Stadium',venueLat:33.9535,venueLon:-118.3392},{...report,eventId:'nfl:2',kickoff:'2026-10-12T20:00:00Z',venueName:'SoFi Stadium',venueLat:33.9535,venueLon:-118.3392}];
  const states=reports.map(item=>({schema:'event-atlas.published-report-state.v8',eventId:item.eventId,changes:[],picture:{usgsContext:{state:'current_snapshot',asOf:'2026-10-10T03:00:00Z',events:[quake]}}}));
  const feed=buildPublishedChangeFeed(reports,states,now);
  assert.equal(feed.items.length,0);
  assert.equal(feed.sharedRegionalRecords.length,1);
  assert.equal(feed.sharedRegionalRecords[0].linkedEvents.length,2);
  const previous=states.map(item=>({...item,picture:{usgsContext:{...item.picture.usgsContext,asOf:'2026-10-10T02:00:00Z',events:[{...quake,magnitude:2.8,updatedAt:'2026-10-10T02:00:00Z'}]}}}));
  const revised=buildPublishedChangeFeed(reports,states,now,previous);
  assert.equal(revised.sharedRegionalRecords[0].revisions.length,2);
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
