import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectNolaReadyEvent} from '../site/nola_ready_event.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';
import {buildPublishedReportState} from '../site/published_report_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/nola_ready_event.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Date.parse(snapshot.checkedAt)+1000;

test('official concurrent city event enters Saints picture, report and public model packet',()=>{
  const selected=selectNolaReadyEvent(game,snapshot,now);
  assert.equal(selected.state,'current_city_notice');
  assert.equal(selected.kickoffWindowOverlap,true);
  const bundle=buildNflEvidenceBundle(game,{schedule,nolaReadyEvent:snapshot},now);
  assert.equal(bundle.picture.cues.find(item=>item.type==='concurrent city event')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(bundle.picture.sources.find(item=>item.name==='NOLA Ready concurrent CBD festival')?.state,'current_city_notice');
  assert.match(buildNflPublicReport(bundle),/Camp Street at N\. Maestri/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K6')?.sourceUrl,snapshot.sourceUrl);
});

test('wrong game, stale notice or missing closure cannot produce city overlap cue',()=>{
  assert.equal(selectNolaReadyEvent(schedule.games.find(item=>item.id!==game.id),snapshot,now).state,'outside_source_event');
  assert.equal(selectNolaReadyEvent(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  const partial={...snapshot,status:'partial',claims:snapshot.claims.filter(item=>item.id!=='camp_closure')};
  const bundle=buildNflEvidenceBundle(game,{schedule,nolaReadyEvent:partial},now);
  assert.equal(bundle.picture.cues.some(item=>item.type==='concurrent city event'),false);
  assert.equal(bundle.picture.sources.find(item=>item.name==='NOLA Ready concurrent CBD festival')?.state,'partial_city_notice');
});

test('city passage revisions become source-linked change notices',()=>{
  const before={eventId:game.id,sources:[],cues:[],nolaReadyEventContext:selectNolaReadyEvent(game,snapshot,now)};
  const after={...before,nolaReadyEventContext:{...before.nolaReadyEventContext,asOf:new Date(now+3600000).toISOString(),claims:before.nolaReadyEventContext.claims.map(item=>item.id==='camp_closure'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  const change=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='city_event_notice_revised');
  assert.equal(change?.sourceUrl,snapshot.sourceUrl);
});

test('published comparison state retains city passage hashes across hourly builds',()=>{
  const beforeBundle=buildNflEvidenceBundle(game,{schedule,nolaReadyEvent:snapshot},now);
  const before=buildPublishedReportState(beforeBundle,game,null,null,now);
  assert.equal(before.picture.nolaReadyEventContext?.claims.length,4);
  const later=now+3600000;
  const revised={...snapshot,checkedAt:new Date(later-1000).toISOString(),claims:snapshot.claims.map(item=>item.id==='camp_closure'?{...item,sourceTextSha256:'b'.repeat(64)}:item)};
  const afterBundle=buildNflEvidenceBundle(game,{schedule,nolaReadyEvent:revised},later);
  const after=buildPublishedReportState(afterBundle,game,null,before,later);
  assert.equal(after.changes.find(item=>item.kind==='city_event_notice_revised')?.sourceUrl,snapshot.sourceUrl);
});
