import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDenverEventPlan,selectDenverEventPlan,DENVER_EVENT_URL} from '../site/denver_event_plan.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildNflBriefingHandoff} from '../site/nfl_briefing_handoff.js';
const html='<html><h1>Denver Broncos vs Seattle Seahawks</h1>Week 6 Game Theme: Fight Like A Bronco October 15, 2026 Event Starts 6:15 PM Gates Open 4:15 PM Parking Lots Open 1:45 PM Doors: 6:15 PM Off-site parking at Ball Arena will not be available for this game.</html>';
const now=Date.parse('2026-10-10T17:00:00Z');
const game={id:'nfl:401872995',venue:{id:'3937',name:'Empower Field at Mile High'},kickoff:'2026-10-16T00:15Z',status:'scheduled'};
const snapshot={...parseDenverEventPlan(html),schema:'event-atlas.denver-event-plan.v1',status:'ok',gameId:game.id,checkedAt:new Date(now).toISOString(),sourceUrl:DENVER_EVENT_URL,sourceTextSha256:'a'.repeat(64)};
test('venue parser separates conflicting published times and exact-game parking restriction',()=>{
  assert.equal(snapshot.doorTimingConflict,true);
  assert.equal(snapshot.ballArenaParking,'listed_unavailable');
  assert.equal(parseDenverEventPlan(html.replace('Doors: 6:15','Doors: 4:15')).doorTimingConflict,false);
  assert.throws(()=>parseDenverEventPlan(html.replace('2026','2025')));
  assert.throws(()=>parseDenverEventPlan(html.replace('Seattle Seahawks','Los Angeles Rams')));
  assert.throws(()=>parseDenverEventPlan(html.replace('Gates Open','Gates closed')));
});
test('selector rejects stale, forged, delayed and wrong-event input',()=>{
  assert.equal(selectDenverEventPlan(game,snapshot,now).state,'current_venue_plan');
  assert.equal(selectDenverEventPlan(game,snapshot,now+13*3600000).state,'unavailable');
  assert.equal(selectDenverEventPlan(game,{...snapshot,doorTimingConflict:false},now).state,'unavailable');
  assert.equal(selectDenverEventPlan({...game,status:'postponed'},snapshot,now).state,'kickoff_unverified');
  assert.equal(selectDenverEventPlan({...game,id:'other'},snapshot,now).state,'outside_source_event');
});
test('exact-game plan reaches evidence, report and leading verification action',()=>{
  const bundle=buildNflEvidenceBundle(game,{denverEventPlan:snapshot},now);
  assert.equal(bundle.denverEventPlan.doorTimingConflict,true);
  assert.match(buildNflPublicReport(bundle),/Denver exact-game venue access plan/);
  assert.equal(buildNflBriefingHandoff(bundle).items[0].kind,'venue timing conflict');
  assert.equal(buildNflBriefingHandoff({...bundle,reportMonitoringMode:'season_planning'}).items.length,0);
});
