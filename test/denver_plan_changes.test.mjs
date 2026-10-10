import test from 'node:test';
import assert from 'node:assert/strict';
import {diffDenverPlan} from '../site/denver_plan_changes.js';
import {DENVER_EVENT_URL} from '../site/denver_event_plan.js';
import {buildPublishedReportState} from '../site/published_report_changes.js';
import {buildPublishedChangeFeed,renderPublishedChangeAtom} from '../lib/published_change_feed.mjs';
const now=Date.parse('2026-10-10T17:00:00Z');
const game={id:'nfl:401872995',venue:{id:'3937'},kickoff:'2026-10-16T00:15Z',status:'scheduled',sourceUrl:'https://www.espn.com/nfl/game/_/gameId/401872995'};
const prior={state:'current_venue_plan',sourceUrl:DENVER_EVENT_URL,checkedAt:'2026-10-10T16:00:00Z',sourceTextSha256:'a'.repeat(64),publicationTime:null,eventStartsLocal:'6:15 PM',gatesOpenLocal:'4:15 PM',parkingOpenLocal:'1:45 PM',doorsLocal:'6:15 PM',doorTimingConflict:true,ballArenaParking:'listed_unavailable'};
const next={...prior,checkedAt:new Date(now).toISOString(),doorsLocal:'4:15 PM',doorTimingConflict:false};
const diff=(a,b,g=game)=>diffDenverPlan(a,b,game,g,new Date(now).toISOString());
test('publisher correction is explained without claiming operational resolution',()=>{
  const changes=diff(prior,next);
  assert.equal(changes[0].kind,'denver_access_plan_revised');
  assert.match(changes[0].detail,/doorsLocal: 6:15 PM → 4:15 PM/);
  assert.match(changes[0].detail,/correction candidate requiring confirmation/);
  assert.equal(changes[0].sourceUrl,DENVER_EVENT_URL);
});
test('unchanged, baseline, out-of-order and rescheduled checks do not produce content revisions',()=>{
  assert.deepEqual(diff(null,next),[]);
  assert.deepEqual(diff(prior,{...prior,checkedAt:next.checkedAt}),[]);
  assert.deepEqual(diff(next,prior),[]);
  assert.deepEqual(diff(prior,next,{...game,kickoff:'2026-10-17T00:15Z'}),[]);
  assert.ok(!diff(prior,{...next,sourceUrl:'https://example.com'}).some(item=>item.kind==='denver_access_plan_revised'));
});
test('stale source becomes a coverage transition, and recovery does not imply a correction',()=>{
  const stale={...prior,checkedAt:'2026-10-09T00:00:00Z'};
  assert.equal(diff(stale,stale)[0].kind,'source_status_changed');
  assert.equal(diff({state:'unavailable',sourceUrl:DENVER_EVENT_URL},next)[0].kind,'source_status_changed');
});
test('observed revision reaches published report state and source-linked Atom entry',()=>{
  const bundle=value=>({denverEventPlan:value,picture:{eventId:game.id,sources:[],cues:[]}});
  const baseline=buildPublishedReportState(bundle(prior),game,null,null,now-3600000);
  const updated=buildPublishedReportState(bundle(next),game,null,baseline,now);
  assert.equal(updated.newItems[0].kind,'denver_access_plan_revised');
  const feed=buildPublishedChangeFeed([{eventId:game.id,path:'reports/nfl-401872995.html',title:'Seahawks at Broncos'}],[updated],now);
  assert.equal(feed.items[0].sourceUrl,DENVER_EVENT_URL);
  assert.match(renderPublishedChangeAtom(feed),/denver_access_plan_revised/);
});
