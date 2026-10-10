import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublishedReportState} from '../site/published_report_changes.js';

const at=Date.parse('2026-10-10T02:00:00Z');
const game={id:'nfl:123',kickoff:'2026-10-11T17:00:00Z',status:'scheduled',timeTbd:false,sourceUrl:'https://www.espn.com/nfl/game/_/gameId/123'};
const source=state=>({name:'NWS point alerts',state,sourceUrl:'https://api.weather.gov/alerts/active'});
const cue={type:'weather alert',title:'Publisher warning',basis:'Published window overlaps event',sourceUrl:'https://api.weather.gov/alerts/123',sourceAt:'2026-10-11T16:00:00Z'};
const bundle=(state,cues=[])=>({picture:{eventId:game.id,sources:[source(state)],cues,forecastContext:{state:'unavailable or stale'}}});

test('published change state starts at a baseline and records only comparable new cues',()=>{
  const baseline=buildPublishedReportState(bundle('checked'),game,null,null,at-3600000);
  assert.equal(baseline.newChangeCount,0);
  assert.match(baseline.comparison,/baseline/);
  const next=buildPublishedReportState(bundle('checked',[cue]),game,null,baseline,at);
  assert.equal(next.newChangeCount,1);
  assert.equal(next.changes[0].kind,'newly_displayed_cue');
  assert.equal(next.changes[0].sourceUrl,cue.sourceUrl);
  const repeated=buildPublishedReportState(bundle('checked',[cue]),game,null,next,at+3600000);
  assert.equal(repeated.newChangeCount,0);
  assert.equal(repeated.changes.length,1);
});

test('failed checks and changed schedules do not claim a new source cue or clearance',()=>{
  const baseline=buildPublishedReportState(bundle('source failed'),game,null,null,at-3600000);
  const recovered=buildPublishedReportState(bundle('checked',[cue]),game,null,baseline,at);
  assert.equal(recovered.changes.filter(item=>item.kind==='newly_displayed_cue').length,0);
  assert.equal(recovered.changes[0].kind,'source_status_changed');
  const moved={...game,kickoff:'2026-10-11T21:00:00Z'};
  const rescheduled=buildPublishedReportState(bundle('checked',[cue]),moved,null,baseline,at);
  assert.equal(rescheduled.changes.find(item=>item.kind==='schedule_changed')?.sourceUrl,game.sourceUrl);
  assert.equal(rescheduled.changes.filter(item=>item.kind==='newly_displayed_cue').length,0);
});

test('stale or mismatched prior state cannot be treated as a comparison',()=>{
  const baseline=buildPublishedReportState(bundle('checked'),game,null,null,at-15*86400000);
  const next=buildPublishedReportState(bundle('checked',[cue]),game,null,baseline,at);
  assert.equal(next.newChangeCount,0);
  assert.match(next.comparison,/baseline/);
  const mismatched={...baseline,eventId:'nfl:other'};
  assert.equal(buildPublishedReportState(bundle('checked',[cue]),game,null,mismatched,at-14*86400000).newChangeCount,0);
});
