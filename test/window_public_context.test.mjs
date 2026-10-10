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
test('participant announcements are event-bound and exclude unrelated personal fields',()=>{
 const game=games[0],person={eventId:game.id,venueId:game.venue.id,name:'Fictional Test Performer',announcedRole:'Test-only program role; attendance unverified.',sourceUrl:'https://example.org/program',sourceTextSha256:'a'.repeat(64),sourceCheckedAt:'2026-10-10T00:00:00Z',attendanceStatus:'unverified',protectiveStatus:'not_assigned',privateAddress:'must not propagate'};
 const bundle={schema:'event-atlas.public-evidence-bundle.v1',status:'unreviewed_public_source_export',generatedAt:'2026-10-10T00:00:00Z',event:game,venue:game.venue,picture:{sources:[],announcedPeople:[person,{...person,eventId:'nfl:0'},{...person,attendanceStatus:'confirmed'},{...person,sourceUrl:'javascript:alert(1)'}]}};
 const result=validateWindowPublicBundle(bundle,game);assert.equal(result.announcements.length,1);assert.equal(result.rejectedAnnouncements,3);assert(!('privateAddress' in result.announcements[0]));
});
