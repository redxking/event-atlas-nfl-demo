import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSaintsGameday} from '../site/saints_gameday.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/saints_gameday.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Date.parse(snapshot.checkedAt)+1000;

test('Saints exact-game plan enters report and local model packet with bounded announced people',()=>{
  const selected=selectSaintsGameday(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.deepEqual(selected.claims.map(item=>item.id),['champions_square','stage_performance','anthem','ring_of_honor','legend_of_game']);
  const bundle=buildNflEvidenceBundle(game,{schedule,saintsGameday:snapshot},now);
  assert.deepEqual(bundle.publicObservations.clubAnnouncedPeople.map(item=>item.name),['Robin Barnes','Drew Brees','Joe Horn']);
  assert.ok(bundle.publicObservations.clubAnnouncedPeople.every(item=>item.attendanceStatus==='unverified'&&item.protectiveStatus==='not_assigned'));
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Saints–Vikings club-published game-day guide/);
  assert.match(report,/Champions Square festivities/);
  assert.match(report,/attendance and protective status are unverified/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K2')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='K3')?.sourceUrl,snapshot.sourceUrl);
});

test('wrong event, stale guide and publisher mismatch cannot become current Saints plans',()=>{
  assert.equal(selectSaintsGameday(schedule.games.find(item=>item.id!=='nfl:401872987'),snapshot,now).state,'outside_source_event');
  assert.equal(selectSaintsGameday(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectSaintsGameday(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],saintsGuideContext:selectSaintsGameday(game,snapshot,now)};
  const after={...before,saintsGuideContext:{...before.saintsGuideContext,asOf:new Date(now+3600000).toISOString(),claims:before.saintsGuideContext.claims.map(item=>item.id==='anthem'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='club_passage_revised')?.sourceUrl,snapshot.sourceUrl);
});
