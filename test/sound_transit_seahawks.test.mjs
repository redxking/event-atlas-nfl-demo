import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSoundTransitSeahawks,compareSounderToGates} from '../site/sound_transit_seahawks.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const read=name=>JSON.parse(readFileSync(new URL(`../site/${name}`,import.meta.url)));
const schedule=read('nfl.json'),sounder=read('sound_transit_seahawks.json'),guide=read('seahawks_gameday.json');
const game=schedule.games.find(item=>item.id==='nfl:401872992');
const now=Math.max(Date.parse(sounder.checkedAt),Date.parse(guide.checkedAt))+1000;

test('Sound Transit exact-game timetable aligns with the published club gate plan',()=>{
  const operator=selectSoundTransitSeahawks(game,sounder,now);
  const bundle=buildNflEvidenceBundle(game,{schedule,seahawksGameday:guide,soundTransitSeahawks:sounder},now);
  assert.equal(operator.state,'current_published_service_plan');
  assert.equal(operator.arrivals.length,5);
  assert.deepEqual(compareSounderToGates(game,bundle.picture.seahawksGuideContext,operator).arrivalsBeforeGate,3);
  assert.equal(bundle.picture.sounderGateContext.arrivalsAfterGate,2);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Sound Transit exact-game Sounder plan/);
  assert.match(report,/Scheduled arrivals before club gate time:\*\* 3/);
  assert.match(report,/not live train tracking|does not verify train operation/);
  const brief={event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}};
  const packet=buildLocalAiPacket(brief,{now});
  assert.equal(packet.evidence.find(item=>item.id==='Z1')?.sourceUrl,sounder.sourceUrl);
});

test('stale, wrong-game, and malformed timetable data fail closed',()=>{
  assert.equal(selectSoundTransitSeahawks(game,sounder,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectSoundTransitSeahawks({...game,id:'nfl:other'},sounder,now).state,'outside_source_event');
  assert.equal(selectSoundTransitSeahawks(game,{...sounder,arrivals:[...sounder.arrivals.slice(0,4),{...sounder.arrivals[4],tripId:'1831'}]},now).state,'stale_or_unavailable');
});

test('a newer operator text revision prompts review without implying cancellation',()=>{
  const prior={eventId:game.id,sources:[],cues:[],soundTransitContext:{...selectSoundTransitSeahawks(game,sounder,now),asOf:'2026-10-10T06:00:00Z'}};
  const next={...prior,soundTransitContext:{...prior.soundTransitContext,asOf:'2026-10-10T07:00:00Z',sourceTextSha256:'a'.repeat(64)}};
  const status={kickoff:game.kickoff,status:game.status,timeTbd:game.timeTbd};
  const changes=diffEventPicture(prior,next,null,null,status,status,'2026-10-10T07:00:01Z');
  assert.equal(changes.find(item=>item.kind==='operator_timetable_revised')?.sourceUrl,sounder.sourceUrl);
  assert.equal(diffEventPicture(prior,{...next,soundTransitContext:{...next.soundTransitContext,state:'stale_or_unavailable'}},null,null,status,status).some(item=>item.kind==='operator_timetable_revised'),false);
});
