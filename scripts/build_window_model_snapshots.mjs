import fs from 'node:fs/promises';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
import {buildExerciseModelPacket} from '../site/window_ai_contract.js';
import {runExerciseModel} from '../lib/window_model_runner.mjs';
const games=JSON.parse(await fs.readFile(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
const path=new URL('../site/window_model_snapshots.json',import.meta.url);
let saved={schema:'event-atlas.window-model-snapshots.v1',results:{},failures:{}};try{saved=JSON.parse(await fs.readFile(path))}catch{}
const requested=process.argv[2];
for(const game of games.filter(g=>!requested||g.id===requested)){
 const brief=replayGameFeed(createGameFeed(game));
 if(saved.results[game.id]?.packetJson===JSON.stringify(buildExerciseModelPacket(brief))){console.log(`${game.id}: reusing matching recorded run`);continue}
 try{const result=await runExerciseModel(brief);saved.results[game.id]=result;delete saved.failures[game.id];console.log(`${game.id}: model completed in ${result.elapsedMs} ms`)}catch(error){delete saved.results[game.id];saved.failures[game.id]={at:new Date().toISOString(),error:error.message};console.error(`${game.id}: ${error.message}`)}
 saved.updatedAt=new Date().toISOString();await fs.writeFile(path,JSON.stringify(saved,null,2)+'\n');
}
if(Object.keys(saved.failures).length)process.exitCode=1;
