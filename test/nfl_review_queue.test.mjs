import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflReviewQueue} from '../site/nfl_review_queue.js';

const now=Date.parse('2026-10-10T04:00:00Z');
const game={status:'scheduled in source',kickoff:'2026-10-11T17:00:00Z'};
const cue={type:'road condition',title:'Lane work',basis:'Published window overlaps illustrative event window',sourceAt:'2026-10-10T03:30:00Z',sourceUrl:'https://example.gov/road/1'};

test('time-screened source cue becomes a linked analyst verification action',()=>{
  const queue=buildNflReviewQueue(game,{cues:[cue]},'near_term_monitoring',now);
  assert.equal(queue.state,'review_candidates');
  assert.equal(queue.items.length,1);
  assert.equal(queue.items[0].sourceUrl,cue.sourceUrl);
  assert.equal(queue.items[0].status,'unreviewed_source_cue');
  assert.match(queue.items[0].action,/Confirm the road record/);
  assert.match(queue.note,/None is a threat/);
});

test('failed point alert source becomes a coverage recovery action, not a negative finding',()=>{
  const queue=buildNflReviewQueue(game,{cues:[cue],sources:[{name:'NWS point alerts',state:'source failed',detail:'Point check failed',asOf:null,sourceUrl:'https://api.weather.gov/alerts/active?point=44.5,-88.0'}]},'near_term_monitoring',now);
  assert.equal(queue.items[0].status,'source_check_needed');
  assert.match(queue.items[0].action,/before drawing any conclusion from an empty alert list/);
  assert.equal(queue.items[1].status,'unreviewed_source_cue');
});

test('planning, empty, and unsafe cue inputs never become unsupported tasks',()=>{
  assert.equal(buildNflReviewQueue(game,{cues:[cue]},'season_planning',now).state,'not_started');
  const empty=buildNflReviewQueue(game,{cues:[]},'near_term_monitoring',now);
  assert.equal(empty.state,'no_time_screened_cues');
  assert.match(empty.note,/not an all-clear/);
  const unsafe=buildNflReviewQueue(game,{cues:[{...cue,sourceUrl:'javascript:alert(1)'},{...cue,type:'unknown'}]},'near_term_monitoring',now);
  assert.equal(unsafe.items.length,0);
  const active=buildNflReviewQueue({...game,status:'in progress in source'},{cues:[cue]},'near_term_monitoring',now);
  assert.equal(active.items[0].phase,'active event');
});
