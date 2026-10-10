import test from 'node:test';
import assert from 'node:assert/strict';
import {selectLambeauGamedayForGame,lambeauGamedayUrl} from '../site/lambeau_gameday.js';

const now=Date.parse('2026-10-10T06:00:00Z');
const game={venue:{id:'3798'},kickoff:'2026-10-11T17:00:00Z',status:'scheduled in source'};
const ids=['gates','oneida','lombardi','postgame','bus','rideshare'];
const claims=ids.map(id=>({id,topic:id,summary:`Published ${id} plan`,sourceUrl:lambeauGamedayUrl,sourceTextSha256:'a'.repeat(64)}));
const snapshot={schema:'event-atlas.lambeau-gameday.v1',status:'ok',checkedAt:'2026-10-10T05:55:00Z',sourceUrl:lambeauGamedayUrl,claims};

test('published venue plan produces explicitly calculated game-time planning windows',()=>{
  const selected=selectLambeauGamedayForGame(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.derivedTimes.gatesOpenAt,'2026-10-11T15:00:00.000Z');
  assert.equal(selected.derivedTimes.oneidaClosureStartAt,'2026-10-11T13:00:00.000Z');
  assert.equal(selectLambeauGamedayForGame({...game,timeTbd:true},snapshot,now).derivedTimes,null);
});

test('stale or incomplete source cannot appear as complete operations',()=>{
  assert.equal(selectLambeauGamedayForGame(game,{...snapshot,status:'partial',claims:claims.slice(1)},now).state,'partial_published_plan');
  assert.equal(selectLambeauGamedayForGame(game,{...snapshot,checkedAt:'2026-10-09T00:00:00Z'},now).state,'stale_or_unavailable');
  assert.equal(selectLambeauGamedayForGame({venue:{id:'3806'}},snapshot,now).state,'outside_source_venue');
});
