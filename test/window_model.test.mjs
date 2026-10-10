import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
import {buildExerciseModelPacket,bindExerciseModelSnapshot,validateExerciseModelSelection,DEMO_MODEL} from '../site/window_ai_contract.js';
import {runExerciseModel} from '../lib/window_model_runner.mjs';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
for(const game of games)test(`${game.id}: exact input binding and synthetic citations`,async()=>{
 const brief=replayGameFeed(createGameFeed(game)),packet=buildExerciseModelPacket(brief);
 const output={rankedCandidateIds:[packet.candidates[2].id]};
 const snapshot=await runExerciseModel(brief,{fetchImpl:async()=>({ok:true,json:async()=>({model:DEMO_MODEL,done:true,message:{content:JSON.stringify(output)}})})});
 assert.equal(bindExerciseModelSnapshot(brief,snapshot).status,'recorded_model_run_matches_inputs');
 assert.equal(bindExerciseModelSnapshot({...brief,clock:'2026-01-01T00:00:00Z'},snapshot).status,'input_changed_or_snapshot_invalid');
 assert.equal(bindExerciseModelSnapshot(brief,{...snapshot,proposal:{rankedCandidateIds:['bogus']}}).status,'invalid_model_output');
 assert.throws(()=>validateExerciseModelSelection({rankedCandidateIds:[packet.candidates[0].id],extra:'text'},packet));
 assert.equal(snapshot.packetSha256.length,64);
});
test('runtime failures cannot become model-generated findings',async()=>{
 const brief=replayGameFeed(createGameFeed(games[0]));
 for(const body of [{model:'wrong',done:true},{model:DEMO_MODEL,done:false},{model:DEMO_MODEL,done:true,message:{content:'not json'}}])await assert.rejects(runExerciseModel(brief,{fetchImpl:async()=>({ok:true,json:async()=>body})}));
 await assert.rejects(runExerciseModel(brief,{fetchImpl:async()=>({ok:false,status:503})}));
 assert.equal(bindExerciseModelSnapshot(brief,null).status,'not_available');
});
