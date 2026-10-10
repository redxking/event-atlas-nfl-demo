import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';import {scenarioStages,simulateExerciseAnalysis} from '../site/window_analysis_simulator.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
for(const game of games)test(`${game.id}: guided states update cited simulated analysis`,()=>{
 const feed=createGameFeed(game),results={};for(const stage of scenarioStages){const initial=replayGameFeed(feed,stage.count),brief=stage.advanceMinutes?replayGameFeed(feed,stage.count,new Date(Date.parse(initial.clock)+stage.advanceMinutes*60000).toISOString()):initial;const result=simulateExerciseAnalysis(brief);results[stage.id]=result;
 assert.equal(result.modelInvoked,false);assert.equal(result.executionMode,'simulated_backend');assert(result.items.every(c=>c.evidence.every(r=>brief.observations.some(o=>o.evidenceId===r.id&&o.claim===r.claim))));}
 assert.equal(results.baseline.items.length,0);assert(results.emerging.items.length>0);
 assert.equal(results.contrary.items.find(c=>c.candidateId.endsWith('C-03')).reviewReason,'Reconcile contrary evidence');
 assert.equal(results.camera_outage.coverage.unavailable,1);assert.equal(results.recovered.coverage.unavailable,0);assert.equal(results.stale.coverage.stale,26);assert(results.stale.items.every(c=>c.reviewReason==='Refresh or restore supporting evidence'));
});
test('live data cannot enter the simulated analysis service',()=>assert.throws(()=>simulateExerciseAnalysis({dataMode:'live'})));
