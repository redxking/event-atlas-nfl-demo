import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
import {cameraPresentation} from '../site/window_camera.js';
import {supplementalFeeds} from '../site/window_supplemental_feeds.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
for(const game of games)test(`${game.id}: supplemental adapters and camera availability`,()=>{
 const feed=createGameFeed(game),full=replayGameFeed(feed);
 for(const source of supplementalFeeds){const record=full.observations.find(r=>r.sourceId===source.id);assert.equal(record.payload.kind,source.payload.kind);assert.equal(record.dataMode,'synthetic_exercise')}
 assert.equal(cameraPresentation(replayGameFeed(feed,25)).playable,false);
 assert.equal(cameraPresentation(replayGameFeed(feed,26)).playable,true);
 assert.equal(cameraPresentation(replayGameFeed(feed,33)).playable,false);
 assert.equal(cameraPresentation(replayGameFeed(feed,34)).playable,false);
 assert.equal(cameraPresentation(full).frame.frame,2);assert.equal(cameraPresentation(full).playable,true);
 assert.equal(cameraPresentation(replayGameFeed(feed,feed.deliveries.length,new Date(Date.parse(full.clock)+31*60000).toISOString())).playable,false);
 assert(full.candidates.find(c=>c.id.endsWith('C-07')).evidenceIds.every(id=>id.startsWith(`${game.id}:exercise:`)));
});
test('reject malformed or non-fictional supplemental payloads',()=>{
 for(const mutate of [f=>f.deliveries[25].payload.vehicles=-1,f=>f.deliveries[25].payload.scene='real',f=>f.deliveries[31].payload.fictional=false]){const feed=createGameFeed(games[0]);mutate(feed);assert.throws(()=>replayGameFeed(feed))}
});
