import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateExerciseCatalog,exerciseFrame,EXERCISE_MODE} from '../site/exercise_scenarios.js';

const catalog=JSON.parse(readFileSync(new URL('../data/demo_scenarios.json',import.meta.url)));

test('fictional scenarios keep their source and evidence identities isolated',()=>{
  validateExerciseCatalog(catalog);
  assert.ok(catalog.scenarios.length>=4);
  for(const scenario of catalog.scenarios){
    const initial=exerciseFrame(catalog,scenario.id,0);
    assert.equal(initial.dataMode,EXERCISE_MODE);
    assert.equal(initial.observations.length,0);
    assert.equal(initial.candidate,null);
    assert.equal(initial.report,null);
    const complete=exerciseFrame(catalog,scenario.id,scenario.observations.length);
    assert.equal(complete.report.dataMode,EXERCISE_MODE);
    assert.ok(complete.report.claimIds.length>0);
    assert.ok(complete.report.claimIds.every(id=>scenario.observations.some(item=>item.id===id)));
    assert.ok(complete.sourceStates.every(item=>item.dataMode===EXERCISE_MODE));
  }
});

test('pop-up event planning details follow the source record order',()=>{
  const first=exerciseFrame(catalog,'sx-popup',0);
  assert.equal(first.planning.organizer,null);
  assert.equal(first.planning.permits,null);
  assert.equal(first.planning.areaHistory,null);
  assert.equal(first.planning.agencyPicture,null);
  const permit=exerciseFrame(catalog,'sx-popup',1);
  assert.equal(permit.planning.attendance.permitCap,1200);
  assert.equal(permit.planning.attendance.value,1800);
  assert.equal(permit.planning.permits.find(item=>item.type==='temporary_structures').state,'unknown');
  assert.equal(permit.planning.areaHistory,null);
  const history=exerciseFrame(catalog,'sx-popup',2);
  assert.equal(history.planning.areaHistory.comparableEvents,18);
  assert.equal(history.planning.areaHistory.violentIncidentReports,2);
  assert.equal(history.candidate,null);
  const promoter=exerciseFrame(catalog,'sx-popup',3);
  assert.equal(promoter.planning.promoter.name,'Fictional Market Circuit');
  assert.equal(promoter.candidate.reviewState,'incomplete_scripted_evidence');
  const complete=exerciseFrame(catalog,'sx-popup',4);
  assert.equal(complete.planning.agencyPicture.resourceNeed.state,'proposed_not_sent');
  assert.deepEqual(complete.candidate.visibleExcludedIds,['sx-p2']);
  assert.equal(complete.report.status,'simulated_analyst_draft');
});

test('call playback separates unconfirmed report, human view, field correction, and later workup',()=>{
  const initial=exerciseFrame(catalog,'sx-call',0);
  assert.equal(initial.call.record,null);
  assert.equal(initial.call.cadPriority,null);
  assert.equal(initial.call.drone,null);
  const caller=exerciseFrame(catalog,'sx-call',1);
  assert.equal(caller.call.record.reportedType,'possible_gunfire');
  assert.equal(caller.call.record.cadPriority,undefined);
  assert.equal(caller.call.cadPriority,null);
  const cad=exerciseFrame(catalog,'sx-call',2);
  assert.equal(cad.call.cadPriority,'exercise_priority_1');
  assert.equal(cad.call.deliveryReceipts.length,1);
  const launch=exerciseFrame(catalog,'sx-call',3);
  assert.equal(launch.call.drone.launchedAt,null);
  assert.equal(launch.call.drone.firstUsableViewAt,null);
  const stream=exerciseFrame(catalog,'sx-call',4);
  assert.equal(stream.call.streamState,'simulated_usable_view_metadata');
  assert.equal(stream.call.drone.media,'synthetic_placeholder_only');
  assert.equal(stream.clock,'2026-10-10T14:03:25-04:00');
  assert.equal(stream.call.timeline.some(item=>item.claimId==='sx-k5'),false);
  const view=exerciseFrame(catalog,'sx-call',5);
  assert.equal(view.call.timeline.some(item=>item.claimId==='sx-k5'),true);
  const field=exerciseFrame(catalog,'sx-call',6);
  assert.deepEqual(field.candidate.visibleContradictingIds,['sx-k6']);
  assert.equal(field.report.version,2);
  assert.equal(field.report.asOfAt,'2026-10-10T14:04:30-04:00');
  assert.equal(field.call.followUp,null);
  const later=exerciseFrame(catalog,'sx-call',11);
  assert.equal(later.call.followUp.incidentBasisClaimId,'sx-k11');
  assert.equal(later.report.supersededBy,'sx-k11');
  assert.equal(later.report.asOfAt,field.report.asOfAt);
  assert.equal(later.call.followUp.federalSource.state,'not_connected_in_demo');
  assert.equal(later.clock,'2026-10-11T02:08:00-04:00');
});

test('lost-link branch freezes before camera observations and the provisional report',()=>{
  const lost=exerciseFrame(catalog,'sx-call',11,'base','lost_link');
  assert.equal(lost.step,4);
  assert.equal(lost.call.streamState,'simulated_stream_unavailable');
  assert.equal(lost.call.drone.firstUsableViewAt,null);
  assert.equal(lost.call.timeline.at(-1).state,'stream_unavailable');
  assert.match(lost.observations.at(-1).claim,/before a usable view/);
  assert.equal(lost.clock,'2026-10-10T14:03:20-04:00');
  assert.equal(lost.observations.some(item=>item.id==='sx-k5'),false);
  assert.equal(lost.report,null);
  assert.equal(lost.call.followUp,null);
  assert.throws(()=>exerciseFrame(catalog,'sx-stadium',4,'base','lost_link'),/Invalid exercise step/);
});

test('stadium candidate gains counterevidence and outage only when their records appear',()=>{
  const early=exerciseFrame(catalog,'sx-stadium',4);
  assert.equal(early.candidate.reviewState,'incomplete_scripted_evidence');
  assert.deepEqual(early.candidate.visibleContradictingIds,[]);
  assert.equal(early.report,null);
  const corrected=exerciseFrame(catalog,'sx-stadium',5);
  assert.deepEqual(corrected.candidate.visibleContradictingIds,['sx-s5']);
  const complete=exerciseFrame(catalog,'sx-stadium',6,'expanded');
  assert.equal(complete.sourceStates.find(item=>item.id==='sx-utility').state,'simulated_unavailable');
  assert.equal(complete.geometry.editState,'preview_only');
  assert.equal(complete.rejectedCandidate.state,'rejected_as_unsupported');
  assert.equal(complete.report.version,2);
});

test('duplicate festival notice and unverified person match are excluded from corroboration',()=>{
  assert.equal(exerciseFrame(catalog,'sx-festival',3).candidate,null);
  assert.deepEqual(exerciseFrame(catalog,'sx-festival',4).candidate.visibleExcludedIds,['sx-f2']);
  const vip=exerciseFrame(catalog,'sx-vip',4);
  assert.deepEqual(vip.candidate.visibleExcludedIds,['sx-v3','sx-v4']);
  assert.equal(vip.scenario.protectedPerson.dataMode,EXERCISE_MODE);
  assert.equal(vip.scenario.protectedPerson.attendanceState,'planned_not_confirmed');
});

test('invalid source mode and unknown evidence references fail closed',()=>{
  assert.throws(()=>validateExerciseCatalog({...catalog,dataMode:'live'}),/Invalid exercise/);
  const changed=structuredClone(catalog);
  changed.scenarios[0].candidate.supportingIds[0]='real-record';
  assert.throws(()=>validateExerciseCatalog(changed),/evidence references/);
  assert.throws(()=>exerciseFrame(catalog,'sx-stadium',100),/Invalid exercise step/);
});
