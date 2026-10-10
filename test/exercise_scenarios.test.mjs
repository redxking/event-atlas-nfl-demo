import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateExerciseCatalog,exerciseFrame,EXERCISE_MODE} from '../site/exercise_scenarios.js';

const catalog=JSON.parse(readFileSync(new URL('../data/demo_scenarios.json',import.meta.url)));

test('fictional scenarios keep their source and evidence identities isolated',()=>{
  validateExerciseCatalog(catalog);
  assert.equal(catalog.scenarios.length,4);
  for(const scenario of catalog.scenarios){
    const initial=exerciseFrame(catalog,scenario.id,0);
    assert.equal(initial.dataMode,EXERCISE_MODE);
    assert.equal(initial.observations.length,0);
    assert.equal(initial.candidate,null);
    assert.equal(initial.report,null);
    const complete=exerciseFrame(catalog,scenario.id,scenario.observations.length);
    assert.equal(complete.report.dataMode,EXERCISE_MODE);
    assert.deepEqual(complete.report.claimIds.sort(),scenario.observations.map(item=>item.id).sort());
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
