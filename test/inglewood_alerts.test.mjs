import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectInglewoodAlerts} from '../site/inglewood_alerts.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {diffEventPicture} from '../site/event_picture_changes.js';
import {buildNflCaseContext} from '../lib/build_nfl_case_context.mjs';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/inglewood_alerts.json',import.meta.url)));
const chargers=schedule.games.find(item=>item.id==='nfl:401872989');
const rams=schedule.games.find(item=>item.id==='nfl:401872994');
const now=Date.parse(snapshot.checkedAt)+1000;

test('city alert listing is sourced but does not claim NFL venue impact',()=>{
  const selected=selectInglewoodAlerts(chargers,snapshot,now);
  assert.equal(selected.state,'current_city_listing');
  assert.equal(selected.categories.traffic.listedCount,1);
  assert.equal(selected.categories.traffic.entries[0].sameLocalDate,false);
  assert.equal(selected.categories.police.listedCount,0);
  const bundle=buildNflEvidenceBundle(chargers,{schedule},now);bundle.inglewoodAlerts=selected;
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Inglewood city alert listings/);
  assert.match(report,/does not establish overlap with the game/);
  assert.match(report,/not a complete dispatch feed/);
  assert.equal(selectInglewoodAlerts(rams,snapshot,now).categories.traffic.entries[0].sameLocalDate,false);
});

test('same-day title requires source validation and city text changes need two checks',()=>{
  const sameDay=structuredClone(snapshot);
  sameDay.categories.traffic.entries[0].title='Traffic Alert Issue 10/11/26';
  assert.equal(selectInglewoodAlerts(chargers,sameDay,now).categories.traffic.entries[0].sameLocalDate,true);
  const event={id:chargers.id,sourceId:'nfl',title:chargers.title,startsAtLocal:chargers.kickoff,status:chargers.status,sourceUrl:chargers.sourceUrl,gameState:chargers.gameState};
  const context=buildNflCaseContext({id:chargers.id,sourceId:'nfl'},event,{schedule,inglewoodAlerts:sameDay},now);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:context},{now});
  assert.equal(packet.evidence.find(item=>item.id==='IG1')?.sourceUrl,sameDay.categories.traffic.entries[0].sourceUrl);
  assert.equal(selectInglewoodAlerts(chargers,{...sameDay,checkedAt:new Date(now-4*3600000).toISOString()},now).state,'unavailable');
  sameDay.categories.traffic.entries[0].sourceUrl='https://example.com/';
  assert.equal(selectInglewoodAlerts(chargers,sameDay,now).state,'unavailable');
  const before={eventId:chargers.id,sources:[],cues:[],inglewoodAlertsContext:selectInglewoodAlerts(chargers,snapshot,now)};
  const changed=structuredClone(snapshot);changed.checkedAt=new Date(now+3600000).toISOString();changed.categories.traffic.entries[0].title='Traffic Alert Issue 10/11/26';
  const after={...before,inglewoodAlertsContext:selectInglewoodAlerts(chargers,changed,now+3600000)};
  assert.equal(diffEventPicture(before,after,null,null,chargers,chargers).find(item=>item.kind==='city_notice_changed')?.sourceUrl,before.inglewoodAlertsContext.categories.traffic.entries[0].sourceUrl);
});
