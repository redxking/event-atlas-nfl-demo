import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublishedReportState} from '../site/published_report_changes.js';
import {buildPublishedChangeFeed} from '../lib/published_change_feed.mjs';

test('one corrected USGS record reaches two event histories and the shared view without changing an unrelated game',()=>{
  const old={sourceId:'ci41345415',sourceUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/ci41345415',title:'M 3.0 near Signal Hill',magnitude:3,occurredAt:'2026-10-09T07:44:17Z',updatedAt:'2026-10-10T11:00:00Z',distanceKm:23.3,point:[-118.1845,33.7875]};
  const current={...old,title:'M 3.2 near Signal Hill',magnitude:3.16,updatedAt:'2026-10-10T14:00:00Z'};
  const reports=[
    {eventId:'nfl:1',title:'Game A',venueName:'SoFi Stadium',venueLat:33.9535,venueLon:-118.3392,kickoff:'2026-10-11T20:00:00Z',path:'reports/nfl-1.html'},
    {eventId:'nfl:2',title:'Game B',venueName:'SoFi Stadium',venueLat:33.9535,venueLon:-118.3392,kickoff:'2026-10-12T20:00:00Z',path:'reports/nfl-2.html'},
    {eventId:'nfl:3',title:'Game C',venueName:'Soldier Field',venueLat:41.8623,venueLon:-87.6167,kickoff:'2026-10-11T17:00:00Z',path:'reports/nfl-3.html'}
  ];
  const game=report=>({id:report.eventId,kickoff:report.kickoff,status:'scheduled',timeTbd:false,sourceUrl:`https://www.espn.com/nfl/game/_/gameId/${report.eventId.slice(4)}`});
  const bundle=(eventId,record,asOf)=>({picture:{eventId,sources:[{name:'USGS earthquake feed',state:'current snapshot',asOf,sourceUrl:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson'}],cues:[],forecastContext:{state:'unavailable or stale'},usgsContext:{state:'current_snapshot',asOf,events:record?[record]:[]}}});
  const prior=reports.map(report=>buildPublishedReportState(bundle(report.eventId,report.eventId==='nfl:3'?null:old,'2026-10-10T12:00:00Z'),game(report),null,null,Date.parse('2026-10-10T12:30:00Z')));
  const next=reports.map((report,index)=>buildPublishedReportState(bundle(report.eventId,report.eventId==='nfl:3'?null:current,'2026-10-10T14:30:00Z'),game(report),null,prior[index],Date.parse('2026-10-10T15:00:00Z')));
  for(const state of next.slice(0,2))assert.match(state.changes.find(item=>item.kind==='usgs_earthquake_revised')?.detail||'',/magnitude 3 → 3.16/);
  assert.equal(next[2].changes.some(item=>item.kind==='usgs_earthquake_revised'),false);
  const feed=buildPublishedChangeFeed(reports,next,Date.parse('2026-10-10T15:30:00Z'),prior);
  assert.equal(feed.items.filter(item=>item.kind==='usgs_earthquake_revised').length,2);
  assert.deepEqual(feed.sharedRegionalRecords[0].revisions.map(item=>item.eventId),['nfl:1','nfl:2']);
  assert.equal(feed.sharedRegionalRecords[0].excludedSample.eventId,'nfl:3');
  const later=buildPublishedChangeFeed(reports,next,Date.parse('2026-10-10T16:30:00Z'),[],feed);
  assert.equal(later.sharedRegionalRecords[0].revisions.length,2);
  assert.ok(later.sharedRegionalRecords[0].revisions.every(item=>item.systemObservedAt==='2026-10-10T15:30:00.000Z'&&item.provenance==='retained_prior_published_feed'));
});
