import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWindowPublicBundle} from '../site/window_public_context.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
for(const game of games.filter(g=>g.reportUrl))test(`${game.id}: public context contract binds exact game, venue and kickoff`,()=>{
 const bundle={schema:'event-atlas.public-evidence-bundle.v1',status:'unreviewed_public_source_export',generatedAt:'2026-10-10T00:00:00Z',event:game,venue:game.venue,picture:{sources:[{name:'Fixture source',state:'fixture_only',asOf:'',detail:'Test fixture',sourceUrl:'https://example.org'}]}};
 assert(validateWindowPublicBundle(bundle,game).sources.length>0);
 assert.throws(()=>validateWindowPublicBundle({...bundle,event:{...bundle.event,id:'nfl:0'}},game));
 assert.throws(()=>validateWindowPublicBundle({...bundle,event:{...bundle.event,kickoff:'2000-01-01T00:00:00Z'}},game));
});
