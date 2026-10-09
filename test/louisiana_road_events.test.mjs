import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLouisianaRoadEvents} from '../lib/louisiana_road_events.mjs';

test('Louisiana road feed excludes old and unbounded incidents, and deduplicates published event windows',()=>{
  const now=Date.parse('2026-10-09T20:00:00Z'),end=Date.parse('2027-01-11T00:00:00Z');
  const record=(id,values={})=>({attributes:{EventID:id,EventStatus:'Confirmed',EventType:'Roadwork',RoadName:'I-10',Description:'Agency-listed closure',EventStartDateUTC:Date.parse('2026-10-11T16:00:00Z'),EventEndDateUTC:Date.parse('2026-10-12T02:00:00Z'),EventLastUpdatedUTC:Date.parse('2026-10-08T18:00:00Z'),...values},geometry:{x:-90.08,y:29.95}});
  const features=[record(1),record(1),record(2,{EventEndDateUTC:null}),record(3,{EventLastUpdatedUTC:Date.parse('2026-09-01T00:00:00Z')}),record(4,{EventStatus:'Ended'}),record(5,{EventEndDateUTC:Date.parse('2026-10-08T00:00:00Z')})];
  const rows=parseLouisianaRoadEvents(features,now,end,'https://example.gov/source');
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'ladotd-511-1');
  assert.equal(rows[0].startAt,'2026-10-11T16:00:00.000Z');
});
