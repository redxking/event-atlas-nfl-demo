import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectFalconsGameday} from '../site/falcons_gameday.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/falcons_gameday.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872993');
const now=Date.parse(snapshot.checkedAt)+1000;

test('Falcons exact-game plans and named appearances enter cited report and model packet',()=>{
  const selected=selectFalconsGameday(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,9);
  const bundle=buildNflEvidenceBundle(game,{schedule,falconsGameday:snapshot},now);
  assert.equal(bundle.publicObservations.clubAnnouncedPeople.length,7);
  assert.ok(bundle.publicObservations.clubAnnouncedPeople.every(item=>item.attendanceStatus==='unverified'&&item.protectiveStatus==='not_assigned'));
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Falcons–Ravens club-published game-day guide/);
  assert.match(report,/roof as planned open, pending weather/);
  assert.match(report,/appearances are subject to change/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='F2')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='F3')?.sourceUrl,snapshot.sourceUrl);
});

test('wrong game, stale page and source mismatch cannot become current Falcons plans',()=>{
  assert.equal(selectFalconsGameday(schedule.games.find(item=>item.id!=='nfl:401872993'),snapshot,now).state,'outside_source_event');
  assert.equal(selectFalconsGameday(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectFalconsGameday(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],falconsGuideContext:selectFalconsGameday(game,snapshot,now)};
  const after={...before,falconsGuideContext:{...before.falconsGuideContext,asOf:new Date(now+3600000).toISOString(),claims:before.falconsGuideContext.claims.map(item=>item.id==='roof_plan'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='club_passage_revised')?.sourceUrl,snapshot.sourceUrl);
});
