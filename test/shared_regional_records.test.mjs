import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSharedRegionalRecords,retainSharedRegionalRevisions} from '../lib/shared_regional_records.mjs';

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

test('one publisher correction records separate before and after values for both linked games',()=>{
  const old={...record,magnitude:3,title:'M 3.0 - near Signal Hill, CA',updatedAt:'2026-10-10T12:00:00Z'};
  const current=[state('nfl:1',[record]),state('nfl:2',[record]),state('nfl:3',[])];
  const prior=['nfl:1','nfl:2'].map(eventId=>({...state(eventId,[old],'2026-10-10T13:00:00Z'),schema:'event-atlas.published-report-state.v8'}));
  const group=buildSharedRegionalRecords(reports,current,now,prior)[0];
  assert.deepEqual(group.revisions.map(item=>item.eventId),['nfl:1','nfl:2']);
  assert.ok(group.revisions.every(item=>item.changedFields.includes('magnitude')&&item.previous.magnitude===3&&item.current.magnitude===3.16&&item.status==='unreviewed_publisher_revision'));
  assert.equal(group.revisions[0].previous.sourceUpdatedAt,old.updatedAt);
  assert.equal(group.revisions[0].current.sourceUpdatedAt,record.updatedAt);
  assert.equal(buildSharedRegionalRecords(reports,current,now,prior.map(item=>({...item,picture:{usgsContext:{...item.picture.usgsContext,state:'stale_or_unavailable'}}})))[0].revisions.length,0);
});

test('shared correction history survives an unchanged hourly build with its original observation time',()=>{
  const old={...record,magnitude:3,updatedAt:'2026-10-10T12:00:00Z'};
  const current=[state('nfl:1',[record]),state('nfl:2',[record]),state('nfl:3',[])];
  const prior=['nfl:1','nfl:2'].map(eventId=>({...state(eventId,[old],'2026-10-10T13:00:00Z'),schema:'event-atlas.published-report-state.v8'}));
  const corrected=buildSharedRegionalRecords(reports,current,now,prior);
  const previousFeed={schema:'event-atlas.published-change-feed.v1',status:'unreviewed_public_source_changes',builtAt:new Date(now).toISOString(),sharedRegionalRecords:corrected};
  const next=buildSharedRegionalRecords(reports,current,now+3600000);
  assert.equal(next[0].revisions.length,0);
  const retained=retainSharedRegionalRevisions(next,previousFeed,now+3600000);
  assert.equal(retained[0].revisions.length,2);
  assert.ok(retained[0].revisions.every(item=>item.systemObservedAt===new Date(now).toISOString()&&item.provenance==='retained_prior_published_feed'));
  assert.equal(retainSharedRegionalRevisions(corrected,previousFeed,now+3600000)[0].revisions.length,2);
  assert.equal(retainSharedRegionalRevisions(next,{...previousFeed,builtAt:'2026-09-20T00:00:00Z'},now+3600000)[0].revisions.length,0);
  assert.equal(retainSharedRegionalRevisions(next,{...previousFeed,sharedRegionalRecords:[{...corrected[0],sourceId:'different'}]},now+3600000)[0].revisions.length,0);
});

test('one NIFC incident point links two games without implying separate fires or game impact',()=>{
  const fire={id:600932,name:'Example incident',lat:33.93,lon:-118.34,updatedAt:'2026-10-10T13:00:00Z',discoveredAt:'2026-10-10T12:00:00Z',acres:10,containedPercent:20,distanceKm:2.7,sourceUrl:'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/600932'};
  const fireState=(eventId,events,asOf='2026-10-10T15:00:00Z')=>({eventId,picture:{wildfireContext:{state:'current_snapshot',asOf,events}}});
  const current=[fireState('nfl:1',[fire]),fireState('nfl:2',[fire]),fireState('nfl:3',[])];
  const groups=buildSharedRegionalRecords(reports,current,now);
  assert.equal(groups.length,1);
  assert.equal(groups[0].sourceType,'NIFC wildfire incident point');
  assert.deepEqual(groups[0].linkedEvents.map(item=>item.eventId),['nfl:1','nfl:2']);
  assert.ok(groups[0].linkedEvents.every(item=>item.windowRelation==='not_time_matched'&&item.possibleImpact==='not_assessed'));
  assert.equal(groups[0].excludedSample.reason,'outside_150_km_candidate_point_rule');
  assert.deepEqual(buildSharedRegionalRecords(reports,[current[0],fireState('nfl:2',[fire],'2026-10-09T00:00:00Z')],now),[]);
  assert.deepEqual(buildSharedRegionalRecords(reports,[current[0],fireState('nfl:2',[{...fire,sourceUrl:'https://example.com/fire'}])],now),[]);
  const old={...fire,acres:5,updatedAt:'2026-10-10T12:30:00Z'};
  const prior=['nfl:1','nfl:2'].map(eventId=>({...fireState(eventId,[old],'2026-10-10T13:30:00Z'),schema:'event-atlas.published-report-state.v8'}));
  const corrected=buildSharedRegionalRecords(reports,current,now,prior);
  assert.deepEqual(corrected[0].revisions.map(item=>item.changedFields),[['acres'],['acres']]);
  assert.equal(corrected[0].revisions[0].previous.acres,5);
  assert.equal(corrected[0].revisions[0].current.acres,10);
  const previousFeed={schema:'event-atlas.published-change-feed.v1',status:'unreviewed_public_source_changes',builtAt:new Date(now).toISOString(),sharedRegionalRecords:corrected};
  const retained=retainSharedRegionalRevisions(buildSharedRegionalRecords(reports,current,now+3600000),previousFeed,now+3600000);
  assert.equal(retained[0].revisions.length,2);
  assert.ok(retained[0].revisions.every(item=>item.provenance==='retained_prior_published_feed'));
});
