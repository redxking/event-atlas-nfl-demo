import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectMartaRail} from '../site/marta_rail.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/marta_rail.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872993');
const now=Date.parse(snapshot.checkedAt)+1000;

test('MARTA same-day rail schedule enters Falcons brief and local analyst packet as a plan',()=>{
  const selected=selectMartaRail(game,snapshot,now);
  assert.equal(selected.state,'current_published_schedule');
  assert.deepEqual(selected.claims.map(item=>item.id),['gold_line','red_line','blue_line','green_line']);
  const bundle=buildNflEvidenceBundle(game,{schedule,martaRail:snapshot},now);
  assert.equal(bundle.publicObservations.martaPublishedRailSchedule.state,'current_published_schedule');
  const report=buildNflPublicReport(bundle);
  assert.match(report,/MARTA published October 11 rail schedule/);
  assert.match(report,/20 minutes after 9 p\.m/);
  assert.match(report,/not a train-position feed/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='F4')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='F4')?.kind,'operator_rail_schedule');
});

test('wrong event, stale page, and invalid source cannot imply current MARTA service',()=>{
  assert.equal(selectMartaRail(schedule.games.find(item=>item.id!=='nfl:401872993'),snapshot,now).state,'outside_service_date');
  assert.equal(selectMartaRail(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectMartaRail(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],martaRailContext:selectMartaRail(game,snapshot,now)};
  const after={...before,martaRailContext:{...before.martaRailContext,asOf:new Date(now+3600000).toISOString(),claims:before.martaRailContext.claims.map(item=>item.id==='blue_line'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='operator_schedule_revised')?.sourceUrl,snapshot.sourceUrl);
});
