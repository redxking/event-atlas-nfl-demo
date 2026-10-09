import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeArlingtonCalls} from '../site/public_safety_relevance.js';

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
