import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectTitansGameday} from '../site/titans_gameday.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/titans_gameday.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872984');
const now=Date.parse(snapshot.checkedAt)+1000;

test('exact Titans guide enters source-linked event report and local AI packet',()=>{
  const selected=selectTitansGameday(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,6);
  const bundle=buildNflEvidenceBundle(game,{schedule,titansGameday:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Titans–Texans club-published game-day guide/);
  assert.match(report,/parking lots opening at 8 a\.m/);
  assert.match(report,/not verified parking, entry/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K1')?.sourceUrl,snapshot.sourceUrl);
});

test('wrong event, stale check, and unmatched source passage cannot become current plans',()=>{
  assert.equal(selectTitansGameday(schedule.games.find(item=>item.id!=='nfl:401872984'),snapshot,now).state,'outside_source_event');
  assert.equal(selectTitansGameday(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectTitansGameday(game,{...snapshot,sourceUrl:'https://example.com/guide'},now).state,'stale_or_unavailable');
  const prior={eventId:game.id,sources:[],cues:[],titansGuideContext:selectTitansGameday(game,snapshot,now)};
  const next={...prior,titansGuideContext:{...prior.titansGuideContext,asOf:new Date(now+3600000).toISOString(),claims:prior.titansGuideContext.claims.map(item=>item.id==='gates_open'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  assert.equal(diffEventPicture(prior,next,null,null,game,game).find(item=>item.kind==='club_passage_revised')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(diffEventPicture({...prior,titansGuideContext:{...prior.titansGuideContext,state:'stale_or_unavailable'}},next,null,null,game,game).some(item=>item.kind==='club_passage_revised'),false);
});
