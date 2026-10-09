import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflCaseContext} from '../lib/build_nfl_case_context.mjs';

const now=Date.parse('2026-10-09T20:00:00Z');
const event={id:'nfl:synthetic',sourceId:'nfl',title:'Synthetic visitors at hosts',startsAtLocal:'2026-10-11T20:00:00Z',status:'scheduled in source',sourceUrl:'https://example.org/game'};
const game={id:event.id,title:event.title,kickoff:event.startsAtLocal,status:event.status,sourceUrl:event.sourceUrl,sourceRetrievedAt:'2026-10-09T19:55:00Z',week:5,timeTbd:false,venue:{id:'synthetic-venue',name:'Synthetic Stadium',address:'Example, USA',lat:40,lon:-75,coordinateStatus:'unreviewed'}};
const subject={id:event.id,sourceId:'nfl'};

test('matched NFL case carries bounded sourced context without assessed threat',()=>{
  const result=buildNflCaseContext(subject,event,{schedule:{builtAt:'2026-10-09T19:55:00Z',games:[game]}},now);
  assert.equal(result.status,'snapshot_available_unreviewed');
  assert.equal(result.evidence.event.id,event.id);
  assert.equal(result.evidence.picture.assessment.severity,'not_assessed');
  assert.equal(result.evidence.geography.zoneRegistry.status,'research_geometry_only');
  assert.ok(result.evidence.picture.gaps.some(gap=>gap.includes('police alert')));
});

test('changed game and stale schedule cannot masquerade as current matched context',()=>{
  const schedule={builtAt:'2026-10-09T19:55:00Z',games:[game]};
  const mismatch=buildNflCaseContext(subject,{...event,startsAtLocal:'2026-10-11T21:00:00Z'},{schedule},now);
  assert.equal(mismatch.status,'source_mismatch');
  assert.equal(mismatch.evidence,null);
  assert.match(mismatch.reason,/kickoff/);
  const stale=buildNflCaseContext(subject,event,{schedule:{...schedule,builtAt:'2026-10-08T00:00:00Z'}},now);
  assert.equal(stale.status,'stale_schedule_snapshot');
  assert.equal(buildNflCaseContext(subject,null,{schedule},now).status,'unavailable');
});
