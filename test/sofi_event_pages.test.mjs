import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSofiEventPage} from '../site/sofi_event_pages.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {diffEventPicture} from '../site/event_picture_changes.js';
import {buildNflCaseContext} from '../lib/build_nfl_case_context.mjs';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/sofi_event_pages.json',import.meta.url)));
const now=Date.parse(snapshot.checkedAt)+1000;
const chargers=schedule.games.find(game=>game.id==='nfl:401872989');
const rams=schedule.games.find(game=>game.id==='nfl:401872994');

test('venue event pages keep exact-game opening plans and visible kickoff conflict',()=>{
  const selected=selectSofiEventPage(chargers,snapshot,now);
  assert.equal(selected.state,'current_venue_event_page');
  assert.equal(selected.parkingLotsOpenLocal,'9:00 AM');
  assert.equal(selected.doorsOpenLocal,'11:00 AM');
  assert.equal(selected.detailKickoffLocal,'1:35 PM');
  assert.equal(selected.detailKickoffConflictsWithSidebar,true);
  const bundle=buildNflEvidenceBundle(chargers,{schedule},now);
  bundle.sofiVenueEvent=selected;
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Internal kickoff discrepancy.*Yes/);
  assert.match(report,/publisher-data discrepancy, not a security incident/);
  const ramsPage=selectSofiEventPage(rams,snapshot,now);
  assert.equal(ramsPage.parkingLotsOpenLocal,'TBD');
  assert.equal(ramsPage.doorsOpenLocal,'TBD');
  assert.equal(ramsPage.detailKickoffConflictsWithSidebar,false);
  const currentEvent={id:chargers.id,sourceId:'nfl',title:chargers.title,startsAtLocal:chargers.kickoff,status:chargers.status,sourceUrl:chargers.sourceUrl,gameState:chargers.gameState};
  const context=buildNflCaseContext({id:chargers.id,sourceId:'nfl'},currentEvent,{schedule,sofiEventPages:snapshot},now);
  assert.equal(context.evidence.sofiVenueEvent.detailKickoffConflictsWithSidebar,true);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:context},{now});
  assert.equal(packet.evidence.find(item=>item.id==='O3')?.sourceUrl,selected.sourceUrl);
});

test('wrong game, stale source and changed venue timing are gated',()=>{
  assert.equal(selectSofiEventPage({...chargers,kickoff:'2026-10-11T20:25Z'},snapshot,now).state,'outside_source_event');
  assert.equal(selectSofiEventPage(chargers,snapshot,now+13*3600000).state,'unavailable');
  const before={eventId:chargers.id,sources:[],cues:[],sofiVenueEventContext:selectSofiEventPage(chargers,snapshot,now)};
  const after={...before,sofiVenueEventContext:{...before.sofiVenueEventContext,asOf:new Date(now+3600000).toISOString(),doorsOpenLocal:'11:30 AM',sourceTextSha256:'a'.repeat(64)}};
  assert.equal(diffEventPicture(before,after,null,null,chargers,chargers).find(item=>item.kind==='venue_event_page_revised')?.sourceUrl,before.sofiVenueEventContext.sourceUrl);
});
