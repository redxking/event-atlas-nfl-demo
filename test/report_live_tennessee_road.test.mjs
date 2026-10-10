import test from 'node:test';
import assert from 'node:assert/strict';
import {directTennesseeRoadEligible,summarizeDirectTennesseeRoad,checkDirectTennesseeRoad} from '../site/report_live_tennessee_road.js';

const now=Date.parse('2026-10-10T12:00:00Z');
const context={monitoringMode:'near_term_monitoring',venueId:'3810',lat:36.166388888,lon:-86.771388888,kickoff:'2026-10-11T17:00:00Z',status:'scheduled in source; unreviewed'};
const feature=(id,lat=36.17,lon=-86.77)=>({attributes:{OBJECTID:id,START_DATE:now-600000,END_DATE:null,REVISED_DATE:now-300000,EVENT_TYPE:'Incident',EVENT_SUBTYPE:'Traffic incident',DESCRIPTION:'Agency-listed road event',HAS_CLOSURE:0},geometry:{x:lon,y:lat}});

test('direct TDOT check is confined to Nissan Stadium and the event window',()=>{
  assert.equal(directTennesseeRoadEligible(context,now),true);
  assert.equal(directTennesseeRoadEligible({...context,venueId:'9999'},now),false);
  assert.equal(directTennesseeRoadEligible({...context,lat:0},now),false);
  assert.equal(directTennesseeRoadEligible({...context,monitoringMode:'season_planning'},now),false);
  assert.equal(directTennesseeRoadEligible({...context,status:'postponed'},now),false);
  assert.equal(directTennesseeRoadEligible({...context,kickoff:'2026-11-11T17:00:00Z'},now),false);
  assert.equal(directTennesseeRoadEligible(context,Date.parse('2026-10-12T00:00:00Z')),false);
});

test('direct TDOT summary retains only current bounded road context, with no time match',()=>{
  const result=summarizeDirectTennesseeRoad(context,{features:[feature(1),feature(2,36.34,-86.61)]},now);
  assert.equal(result.returnedCount,2);
  assert.equal(result.nearbyCount,1);
  assert.equal(result.records[0].id,'tdot-smartway-1');
  assert.equal(result.records[0].startAt,null);
  assert.equal(result.records[0].timingPolicy,'source_listed_only');
  assert.match(result.sourceUrl,/spatial\.tdot\.tn\.gov/);
  assert.throws(()=>summarizeDirectTennesseeRoad(context,{features:[],exceededTransferLimit:true},now),/incomplete/);
  assert.throws(()=>summarizeDirectTennesseeRoad(context,{features:Array(1000).fill(feature(1))},now),/incomplete/);
});

test('direct TDOT check does not query outside its allowed event context',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('unexpected fetch')};
  try{await assert.rejects(checkDirectTennesseeRoad({...context,venueId:'9999'},now),/Outside direct TDOT window/)}
  finally{globalThis.fetch=original}
});
