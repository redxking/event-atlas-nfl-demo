import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameFeed,replayGameFeed,feedCatalog} from '../site/window_feed_engine.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
const scope=JSON.parse(fs.readFileSync(new URL('../data/nfl_demo_window_scope.json',import.meta.url)));
test('frozen window covers each game exactly once',()=>assert.deepEqual(games.map(g=>g.id).sort(),[...scope.frozenGameIds].sort()));
for(const game of games)test(`${game.id}: ingestion, correlation, contrary evidence and failure recovery`,()=>{
 const feed=createGameFeed(game),initial=replayGameFeed(feed,0),before=replayGameFeed(feed,10),full=replayGameFeed(feed);
 assert.equal(initial.observations.length,0);assert.equal(before.candidates.length,0);
 assert.equal(full.observations.length,20);assert.equal(full.sources.length,feedCatalog.length);assert.equal(full.duplicatesExcluded,1);
 assert.equal(full.candidates.length,5);assert.equal(full.candidates.find(c=>c.id.endsWith(':C-03')).contraryEvidenceIds.length,1);
 assert.equal(replayGameFeed(feed,22).sources[9].state,'unavailable');assert.equal(full.sources[9].state,'simulated_connected');
 assert.equal(full.observations.find(r=>r.recordId==='S-13').revision,2);
 assert.equal(full.observations.find(r=>r.recordId==='S-16').revision,2);
 assert.equal(full.history.filter(r=>r.operation==='correct').length,2);
 assert(full.observations.every(r=>r.evidenceId.startsWith(`${game.id}:exercise:`)));
 assert(replayGameFeed(feed,feed.deliveries.length,new Date(Date.parse(full.clock)+31*60000).toISOString()).sources.every(s=>s.state==='stale'));
 const ids=new Set(full.observations.map(r=>r.evidenceId));assert(full.candidates.every(c=>[...c.evidenceIds,...c.contraryEvidenceIds].every(id=>ids.has(id))));
 assert.equal(full.assessment.severity,'not_assessed');assert.match(full.assessment.model,/no model invoked/);
});
test('rejects cross-event and live records, missing corrections and invalid clocks',()=>{
 for(const mutate of [f=>f.deliveries[0].eventId='nfl:0',f=>f.deliveries[0].dataMode='live',f=>f.deliveries[0].deliveryId=null,f=>f.deliveries[22].supersedes='S-99']){const f=createGameFeed(games[0]);mutate(f);assert.throws(()=>replayGameFeed(f))}
 assert.throws(()=>replayGameFeed(null));assert.throws(()=>replayGameFeed(createGameFeed(games[0]),1,'2000-01-01'));
});
