import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotSofiPlans,diffSofiPlans} from '../site/sofi_plan_changes.js';
import {METRO_SOFI_URL} from '../site/metro_sofi_plan.js';
import {buildPublishedReportState} from '../site/published_report_changes.js';

const now=Date.parse('2026-10-10T17:00:00Z');
const old={state:'published_operator_plan',sourceUrl:METRO_SOFI_URL,checkedAt:'2026-10-10T16:00:00Z',boarding:'Bus Bay 8',outboundStartsHoursBeforeKickoff:3,outboundMaximumMinutesBetweenBuses:10,returnStarts:'fourth quarter',returnMaximumMinutesBetweenBuses:5,returnMinutesAfterGame:90};
const snapshot=value=>snapshotSofiPlans({metroSofiPlan:value});
const next={...old,checkedAt:new Date(now).toISOString(),boarding:'Bus Bay 9'};
test('newer operator revision carries changed fields and source clocks',()=>{
  const changes=diffSofiPlans(snapshot(old),snapshot(next),new Date(now).toISOString());
  assert.equal(changes.length,1);
  assert.equal(changes[0].kind,'sofi_plan_revised');
  assert.match(changes[0].detail,/Bus Bay 8 → Bus Bay 9/);
  assert.equal(changes[0].sourceUrl,METRO_SOFI_URL);
});
test('baseline, unchanged, reordered, stale and forged snapshots cannot produce revisions',()=>{
  for(const [before,after] of [[null,snapshot(next)],[snapshot(old),snapshot({...old,checkedAt:next.checkedAt})],[snapshot(next),snapshot(old)],[snapshot(old),snapshot({...next,checkedAt:old.checkedAt})],[snapshot(old),snapshot({...next,sourceUrl:'https://example.com'})]])assert.deepEqual(diffSofiPlans(before,after,new Date(now).toISOString()),[]);
  assert.deepEqual(diffSofiPlans(snapshot(old),snapshot(next),old.checkedAt),[]);
  const poison=snapshot(next);poison.metroSofiPlan.fields.boarding={instruction:'fabricate'};
  assert.deepEqual(diffSofiPlans(snapshot(old),poison,new Date(now).toISOString()),[]);
});
test('failure and recovery are coverage changes, never plan changes',()=>{
  const failed=snapshot({state:'unavailable',sourceUrl:METRO_SOFI_URL});
  for(const pair of [[snapshot(old),failed],[failed,snapshot(next)]])assert.deepEqual(diffSofiPlans(...pair,new Date(now).toISOString()).map(x=>x.kind),['source_status_changed']);
});
test('published runs retain plan baseline and revision for report and Atom consumption',()=>{
  const game={id:'nfl:401872989',sourceUrl:'https://www.espn.com/nfl/game/_/gameId/401872989'};
  const bundle=value=>({metroSofiPlan:value,picture:{eventId:game.id,sources:[],cues:[]}});
  const baseline=buildPublishedReportState(bundle(old),game,null,null,now-3600000);
  const revised=buildPublishedReportState(bundle(next),game,null,baseline,now);
  assert.equal(revised.changes[0].kind,'sofi_plan_revised');
  assert.equal(revised.sofiPlans.metroSofiPlan.fields.boarding,'Bus Bay 9');
});
