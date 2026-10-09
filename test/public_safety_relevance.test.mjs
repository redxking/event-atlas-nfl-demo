import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeArlingtonCalls,seattleCallQueries,summarizeSeattleCalls} from '../site/public_safety_relevance.js';

test('Arlington incident context uses time and distance without exposing incident detail',()=>{
  const now=Date.parse('2026-10-09T20:00:00Z');
  const game={kickoff:'2026-10-09T22:00:00Z',timeTbd:false};
  const venue={lat:32.74769,lon:-97.09288};
  const feature=(lon,lat,time)=>({geometry:{coordinates:[lon,lat]},properties:{CallDate:Date.parse(time),UpdatedDate:Date.parse(time)+60000,Location:'private detail'}});
  const result=summarizeArlingtonCalls({features:[feature(-97.09,32.75,'2026-10-09T19:00:00Z'),feature(-97.3,32.9,'2026-10-09T19:00:00Z'),feature(-97.09,32.75,'2026-10-08T01:00:00Z')]},venue,game,now);
  assert.deepEqual(result,{nearby:1,windowCount:1,gameWindowCurrent:true,newestUpdate:Date.parse('2026-10-09T19:01:00Z')});
  assert.equal(JSON.stringify(result).includes('private detail'),false);
  assert.throws(()=>summarizeArlingtonCalls({features:[],exceededTransferLimit:true},venue,game,now),/incomplete/);
});

test('Seattle query requests spatially bounded IDs over the last 12 local hours',()=>{
  const venue={lat:47.5952,lon:-122.3316};
  const {countUrl,latestUrl}=seattleCallQueries(venue,Date.parse('2026-10-09T20:00:00Z'));
  const count=new URL(countUrl).searchParams;
  assert.equal(count.get('where'),"ORIG_TIME_QUEUED >= TIMESTAMP '2026-10-09 01:00:00'");
  assert.equal(count.get('geometry'),'-122.3316,47.5952');
  assert.equal(count.get('distance'),'5000');
  assert.equal(count.get('returnIdsOnly'),'true');
  assert.equal(count.has('returnCountOnly'),false);
  assert.equal(count.has('outFields'),false);
  assert.equal(new URL(latestUrl).searchParams.get('outFields'),'ORIG_TIME_QUEUED');
  const winter=seattleCallQueries(venue,Date.parse('2026-12-09T20:00:00Z'));
  assert.equal(new URL(winter.countUrl).searchParams.get('where'),"ORIG_TIME_QUEUED >= TIMESTAMP '2026-12-09 00:00:00'");
});

test('Seattle aggregation exposes only a fresh count and source time',()=>{
  const now=Date.parse('2026-10-09T20:00:00Z');
  const latest={features:[{attributes:{ORIG_TIME_QUEUED:now-10*60000,caseNumber:'sensitive'}}]};
  const result=summarizeSeattleCalls({objectIds:[101,102]},latest,now);
  assert.deepEqual(result,{nearby:2,windowCount:null,gameWindowCurrent:false,newestUpdate:now-10*60000,periodHours:12,radiusKm:5});
  assert.equal(JSON.stringify(result).includes('101'),false);
  assert.equal(summarizeSeattleCalls({objectIds:null},latest,now).nearby,0);
  assert.throws(()=>summarizeSeattleCalls({},latest,now),/incomplete/);
  assert.throws(()=>summarizeSeattleCalls({objectIds:[101,101]},latest,now),/invalid/);
  assert.throws(()=>summarizeSeattleCalls({objectIds:[101]},{features:[{attributes:{ORIG_TIME_QUEUED:now-31*60000}}]},now),/no recent update/);
});
