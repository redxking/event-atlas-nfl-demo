import test from 'node:test';
import assert from 'node:assert/strict';
import {METRO_I105_DETAIL_URL,METRO_I105_LIST_URL,parseMetroI105Notice,selectMetroI105Notice} from '../site/metro_i105_notice.js';

const list='<a href="https://cloud.sfmc.metro.net/LaneClosures_CentralAv_to_I110">October 10-11, 2026</a>';
const detail=`<h2>Westbound I-105 (Central Av to I-110): Extended Lane Closures</h2>
<p>Westbound I-105 from Central Av to I-110: Friday, October 9 at 10pm through Sunday, October 11 at 10am</p>
<p>Center lanes including the HOV and #1 lane will be closed on westbound I-105.</p>
<p>Other westbound travel lanes will remain open to traffic.</p>
<p>A Metro C Line bus bridge will be in place from Friday, October 9 at 9pm through Saturday, October 10 at 9am.</p>`;
const game={venue:{id:'7065'},kickoff:'2026-10-11T20:05:00.000Z',status:'scheduled in source; unreviewed',timeTbd:false};
const now=Date.parse('2026-10-10T17:00:00Z');

test('Metro dated lane notice is source linked and overlaps only the illustrative pregame window',()=>{
  const snapshot=parseMetroI105Notice(list,detail,'2026-10-10T16:00:00Z');
  assert.equal(snapshot.sourceUrl,METRO_I105_DETAIL_URL);
  assert.equal(snapshot.listUrl,METRO_I105_LIST_URL);
  const selected=selectMetroI105Notice(game,snapshot,now);
  assert.equal(selected.state,'pregame_window_overlap');
  assert.equal(selected.overlapMinutes,55);
  assert.equal(selected.endsBeforeKickoffMinutes,185);
  assert.equal(selected.cLineBridgeEnd,'2026-10-10T16:00:00.000Z');
});

test('Metro notice fails closed for changed text, stale source, or another event',()=>{
  assert.throws(()=>parseMetroI105Notice(list,detail.replace('10am','10pm')));
  const snapshot=parseMetroI105Notice(list,detail,'2026-10-10T01:00:00Z');
  assert.equal(selectMetroI105Notice(game,snapshot,now).state,'unavailable');
  assert.equal(selectMetroI105Notice({...game,venue:{id:'3798'}},snapshot,now).state,'outside_source_event');
  assert.equal(selectMetroI105Notice({...game,kickoff:'2026-10-11T03:00:00.000Z'},snapshot,now).state,'outside_source_event');
  assert.equal(selectMetroI105Notice({...game,kickoff:'2026-10-12T20:05:00.000Z'},snapshot,now).state,'outside_source_event');
});
