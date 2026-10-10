import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectCommandersGameday} from '../site/commanders_gameday.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/commanders_gameday.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872988');
const now=Date.parse(snapshot.checkedAt)+1000;

test('Commanders exact-game plan and announced roles enter cited brief',()=>{
  const selected=selectCommandersGameday(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,9);
  const bundle=buildNflEvidenceBundle(game,{schedule,commandersGameday:snapshot},now);
  assert.deepEqual(bundle.publicObservations.clubAnnouncedPeople.map(item=>item.name),['Generald Wilson','Taylor Heinicke']);
  assert.ok(bundle.publicObservations.clubAnnouncedPeople.every(item=>item.attendanceStatus==='unverified'&&item.protectiveStatus==='not_assigned'));
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Commanders–Giants exact-game guide/);
  assert.match(report,/rideshare lots opening at 8 a\.m/);
  assert.match(report,/attendance or execution/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='C1')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='C2')?.sourceUrl,snapshot.sourceUrl);
});

test('wrong game, stale source, and changed publisher passage remain bounded',()=>{
  assert.equal(selectCommandersGameday(schedule.games.find(item=>item.id!=='nfl:401872988'),snapshot,now).state,'outside_source_event');
  assert.equal(selectCommandersGameday(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectCommandersGameday(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],commandersGuideContext:selectCommandersGameday(game,snapshot,now)};
  const after={...before,commandersGuideContext:{...before.commandersGuideContext,asOf:new Date(now+3600000).toISOString(),claims:before.commandersGuideContext.claims.map(item=>item.id==='gates_open'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='club_passage_revised')?.sourceUrl,snapshot.sourceUrl);
});
