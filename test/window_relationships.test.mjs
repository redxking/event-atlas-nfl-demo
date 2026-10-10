import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
import {windowRelationships} from '../site/window_relationships.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
const briefs=games.map(g=>replayGameFeed(createGameFeed(g)));
for(const game of games)test(`${game.id}: scoped schedule and synthetic links retain both evidence references`,()=>{
 const links=windowRelationships(games,game.id,briefs);
 assert.equal(links.evidenceLinks.length,games.length-1);
 assert(links.venueLinks.every(r=>games.find(g=>g.id===r.eventId).venue.id===game.venue.id));
 assert(links.evidenceLinks.every(r=>r.evidenceIds.length===2&&r.evidenceIds[0].startsWith(game.id)&&r.evidenceIds[1].startsWith(r.eventId)&&r.basis.includes('not independent corroboration')));
 assert.equal(windowRelationships(games,game.id,[]).evidenceLinks.length,0);
});
test('live and out-of-scope evidence rejected',()=>{
 assert.throws(()=>windowRelationships(games,games[0].id,[{...briefs[0],dataMode:'live'}]));
 assert.throws(()=>windowRelationships(games,'nfl:0',briefs));
});
