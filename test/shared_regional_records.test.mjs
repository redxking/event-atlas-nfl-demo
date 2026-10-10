import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSharedRegionalRecords} from '../lib/shared_regional_records.mjs';

const now=Date.parse('2026-10-10T15:30:00Z');
const record={sourceId:'ci41345415',sourceUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/ci41345415',title:'M 3.2 - near Signal Hill, CA',magnitude:3.16,occurredAt:'2026-10-09T07:44:17Z',updatedAt:'2026-10-10T14:08:17Z',distanceKm:23.3,point:[-118.1845,33.7875]};
const reports=[
  {eventId:'nfl:1',title:'Game A',venueName:'SoFi Stadium',venueLat:33.9535,venueLon:-118.3392,kickoff:'2026-10-11T20:00:00Z',path:'reports/nfl-1.html'},
  {eventId:'nfl:2',title:'Game B',venueName:'SoFi Stadium',venueLat:33.9535,venueLon:-118.3392,kickoff:'2026-10-12T20:00:00Z',path:'reports/nfl-2.html'},
  {eventId:'nfl:3',title:'Game C',venueName:'Soldier Field',venueLat:41.8623,venueLon:-87.6167,kickoff:'2026-10-11T17:00:00Z',path:'reports/nfl-3.html'}
];
const state=(eventId,events,asOf='2026-10-10T15:00:00Z')=>({eventId,picture:{usgsContext:{state:'current_snapshot',asOf,events}}});

test('one USGS record groups two games and shows an unrelated third game outside the display radius',()=>{
  const groups=buildSharedRegionalRecords(reports,[state('nfl:1',[record]),state('nfl:2',[record]),state('nfl:3',[])],now);
  assert.equal(groups.length,1);
  assert.equal(groups[0].sourceIndependence,'one_publisher_record_across_events');
  assert.deepEqual(groups[0].linkedEvents.map(item=>item.eventId),['nfl:1','nfl:2']);
  assert.ok(groups[0].linkedEvents.every(item=>item.windowRelation==='outside_illustrative_event_window'&&item.possibleImpact==='not_assessed'));
  assert.equal(groups[0].excludedSample.eventId,'nfl:3');
  assert.ok(groups[0].excludedSample.distanceKm>250);
  assert.match(groups[0].limitations,/does not establish shaking/);
});

test('stale, mismatched and single-event publisher records do not become shared occurrences',()=>{
  assert.deepEqual(buildSharedRegionalRecords(reports,[state('nfl:1',[record]),state('nfl:2',[record],'2026-10-09T00:00:00Z')],now),[]);
  assert.deepEqual(buildSharedRegionalRecords(reports,[state('nfl:1',[record]),state('nfl:2',[{...record,sourceUrl:'https://example.com/other'}])],now),[]);
  assert.deepEqual(buildSharedRegionalRecords(reports,[state('nfl:1',[record]),state('nfl:2',[{...record,point:[-118.5,33.8]}])],now),[]);
});
