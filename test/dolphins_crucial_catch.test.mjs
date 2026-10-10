import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectDolphinsCrucialCatch} from '../site/dolphins_crucial_catch.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/dolphins_crucial_catch.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872982');
const now=Date.parse(snapshot.checkedAt)+1000;

test('exact-game Dolphins program enters the cited report and bounded local model packet',()=>{
  const selected=selectDolphinsCrucialCatch(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,6);
  const bundle=buildNflEvidenceBundle(game,{schedule,dolphinsCrucialCatch:snapshot},now);
  assert.deepEqual(bundle.publicObservations.clubAnnouncedPeople.map(item=>item.name),['Stephen Nimer','Nicole Almeida']);
  assert.ok(bundle.publicObservations.clubAnnouncedPeople.every(item=>item.attendanceStatus==='unverified'&&item.protectiveStatus==='not_assigned'));
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Dolphins–Bengals club-published Crucial Catch program/);
  assert.match(report,/halftime DCC recognition/);
  assert.match(report,/individual attendance, protective status/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='D2')?.sourceUrl,snapshot.sourceUrl);
});

test('wrong game, stale or altered Dolphins source cannot become a current announcement',()=>{
  assert.equal(selectDolphinsCrucialCatch(schedule.games.find(item=>item.id!=='nfl:401872982'),snapshot,now).state,'outside_source_event');
  assert.equal(selectDolphinsCrucialCatch(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectDolphinsCrucialCatch(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],dolphinsCrucialCatchContext:selectDolphinsCrucialCatch(game,snapshot,now)};
  const after={...before,dolphinsCrucialCatchContext:{...before.dolphinsCrucialCatchContext,asOf:new Date(now+3600000).toISOString(),claims:before.dolphinsCrucialCatchContext.claims.map(item=>item.id==='halftime_recognition'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='club_passage_revised')?.sourceUrl,snapshot.sourceUrl);
});
