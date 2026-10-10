import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {appendBriefSnapshot,historyArchive} from '../site/window_brief_history.js';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
test('snapshots preserve prior evidence after correction, without recursive nesting',()=>{
 const feed=createGameFeed(games[0]),first=replayGameFeed(feed,19),last=replayGameFeed(feed);let h=appendBriefSnapshot([],first);h=appendBriefSnapshot(h,last);
 assert.equal(h.length,2);assert.equal(h[0].brief.observations.find(r=>r.recordId==='S-16').revision,1);assert.equal(h[1].brief.observations.find(r=>r.recordId==='S-16').revision,2);
 assert.equal(appendBriefSnapshot(h,{...last,reportHistory:[{id:'ignored'}]}).length,2);
 const archive=historyArchive(h);archive.snapshots[0].brief.observations[0].claim='mutation';assert.notEqual(h[0].brief.observations[0].claim,'mutation');
 assert.throws(()=>appendBriefSnapshot(h,replayGameFeed(createGameFeed(games[1]))));
});
