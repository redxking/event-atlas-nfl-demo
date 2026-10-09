import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExerciseBrief,exerciseDomains,exerciseStages} from '../site/demo_exercise.js';

test('exercise covers every requested source domain without claiming a live finding',()=>{
  const brief=buildExerciseBrief(exerciseStages.length-1);
  assert.equal(brief.kind,'simulated_training_exercise');
  assert.equal(brief.domains.length,6);
  assert.equal(brief.observations.length,19);
  assert.ok(brief.domains.every(domain=>domain.count>0&&domain.sources.length>0));
  assert.ok(brief.correlations.length>=3);
  assert.equal(brief.assessment.severity,'not_assessed');
  assert.match(brief.assessment.model,/No AI model invoked/);
  assert.ok(brief.correlations.every(candidate=>candidate.evidence.every(id=>brief.observations.some(item=>item.id===id))));
  assert.equal(exerciseDomains.flatMap(domain=>domain.sources).length,19);
  assert.doesNotMatch(JSON.stringify(brief),/real person named|confirmed attack/i);
});

test('exercise playback only exposes correlations after all cited observations',()=>{
  const baseline=buildExerciseBrief(0),operations=buildExerciseBrief(1),full=buildExerciseBrief(3);
  assert.equal(baseline.correlations.length,0);
  assert.ok(operations.correlations.some(item=>item.id==='C-01'));
  assert.ok(!operations.correlations.some(item=>item.id==='C-03'));
  assert.ok(full.correlations.some(item=>item.id==='C-03'));
  assert.throws(()=>buildExerciseBrief(99),/Unknown exercise stage/);
});
