import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRoadContext} from '../site/road_relevance.js';

const now=Date.parse('2026-10-09T18:00:00Z');
const game={kickoff:'2026-10-11T20:00:00Z',timeTbd:false,venue:{id:'stadium'}};
const snapshot={builtAt:'2026-10-09T17:00:00Z',coverageFrom:'2026-10-09T17:00:00Z',coverageThrough:'2026-10-16T17:00:00Z',byVenue:{stadium:[
  {id:'near-other-day',distanceKm:1,startAt:'2026-10-12T08:00:00Z',endAt:'2026-10-12T10:00:00Z'},
  {id:'far-overlap',distanceKm:8,startAt:'2026-10-11T18:00:00Z',endAt:'2026-10-11T22:00:00Z'},
  {id:'untimed',distanceKm:2,startAt:null,endAt:null}
]}};

test('kickoff window puts a farther overlapping closure before closer unrelated records',()=>{
  const result=selectRoadContext(game,snapshot,now);
  assert.equal(result.timingState,'matched');
  assert.equal(result.overlapCount,1);
  assert.equal(result.records[0].id,'far-overlap');
  assert.equal(result.records[0].overlaps,true);
  assert.equal(result.records[1].overlaps,false);
  assert.equal(result.records.find(record=>record.id==='untimed').overlaps,false);
});

test('an active game keeps current road records time screened after kickoff',()=>{
  const liveNow=Date.parse('2026-10-11T21:00:00Z');
  const liveSnapshot={...snapshot,builtAt:'2026-10-11T20:55:00Z',coverageFrom:'2026-10-11T20:55:00Z',coverageThrough:'2026-10-18T20:55:00Z'};
  const result=selectRoadContext({...game,status:'in progress in source'},liveSnapshot,liveNow);
  assert.equal(result.timingState,'matched');
  assert.equal(result.overlapCount,1);
  assert.equal(result.records[0].id,'far-overlap');
});

test('TBD, stale, past, and out-of-window games do not get temporal matches',()=>{
  const cases=[
    [{...game,timeTbd:true},snapshot,'kickoff_tbd'],
    [{...game,status:'cancelled in source'},snapshot,'cancelled'],
    [game,{...snapshot,builtAt:'2026-10-08T00:00:00Z'},'stale'],
    [{...game,kickoff:'2026-10-08T20:00:00Z'},snapshot,'past_or_invalid'],
    [{...game,kickoff:'2026-11-11T20:00:00Z'},snapshot,'outside_window']
  ];
  for(const [event,data,state] of cases){const result=selectRoadContext(event,data,now);assert.equal(result.timingState,state);assert.equal(result.overlapCount,0);assert.ok(result.records.every(record=>!record.overlaps))}
});

test('a venue without a connected road feed is not reported as a clean match',()=>{
  const result=selectRoadContext({...game,venue:{id:'other-stadium'}},snapshot,now);
  assert.equal(result.timingState,'no_coverage');
  assert.equal(result.overlapCount,0);
  assert.deepEqual(result.records,[]);
});

test('a fresh Illinois published window can be compared beyond the Caltrans seven-day horizon',()=>{
  const chicago={kickoff:'2026-10-22T20:00:00Z',timeTbd:false,venue:{id:'soldier'}};
  const data={...snapshot,timedCoverageByVenue:{soldier:{from:'2026-10-09T17:00:00Z',through:'2027-01-10T05:00:00Z'}},byVenue:{soldier:[{id:'idot-closure-14',agency:'Illinois DOT',distanceKm:8.3,startAt:'2026-04-13T12:00:00Z',endAt:'2027-10-29T12:00:00Z'}]}};
  const result=selectRoadContext(chicago,data,now);
  assert.equal(result.timingState,'matched');
  assert.equal(result.overlapCount,1);
  assert.equal(result.records[0].overlaps,true);
  assert.equal(selectRoadContext(chicago,{...data,builtAt:'2026-10-08T00:00:00Z'},now).overlapCount,0);
});

test('Tennessee source-listed events cannot become kickoff time overlaps',()=>{
  const data={...snapshot,timedCoverageByVenue:{stadium:{from:null,through:null,sourceListedOnly:true}},byVenue:{stadium:[{id:'tdot-1',agency:'Tennessee DOT SmartWay',distanceKm:3,startAt:null,endAt:null,timingPolicy:'source_listed_only'}]}};
  const result=selectRoadContext(game,data,now);
  assert.equal(result.timingState,'source_listed_only');
  assert.equal(result.overlapCount,0);
  assert.equal(result.records[0].timed,false);
});
