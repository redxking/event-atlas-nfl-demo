import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {demoOperationalFeeds,demoReplayFrame} from '../site/demo_operational_feeds.js';
import {buildScopeThreatReport} from '../site/scope_threat_report.js';
const scope=JSON.parse(fs.readFileSync('data/nfl_demo_window_scope.json'));
const nfl=JSON.parse(fs.readFileSync('site/nfl.json'));
const games=nfl.games.filter(g=>scope.frozenGameIds.includes(g.id));
test('all 27 US window games have six typed fictional records bound to the correct event',()=>{
 assert.equal(games.length,27);const ids=new Set();for(const game of games){const demo=demoOperationalFeeds(game);assert.equal(demo.records.length,6);assert.equal(new Set(demo.records.map(r=>r.category)).size,6);for(const r of demo.records){assert.equal(r.eventId,game.id);assert.match(r.classification,/Fictional/);assert.ok(Number.isFinite(Date.parse(r.observedAt)));assert.ok(Object.keys(r.fields).length>=4);assert.ok(!ids.has(r.id));ids.add(r.id);}}
});
test('briefing keeps lead claims, sensor identity gaps and resolved credentials distinct',()=>{const demo=demoOperationalFeeds(games[0]);assert.match(demo.briefing.assessment,/do not independently corroborate/);assert.match(demo.briefing.resolved,/should not remain an active/);assert.match(demo.records.find(r=>r.key==='aviation').assessment,/does not prove/);assert.match(demo.records.find(r=>r.key==='cyber').fields['Example host'],/\.invalid$/);});
test('fixtures do not populate real findings or counts',()=>{const report=buildScopeThreatReport({title:'Event',level:'event',games:[games[0]],summaries:new Map()});assert.equal(report.findings.length,0);assert.equal(report.decisions.length,0);assert.equal(demoOperationalFeeds({id:'bad',kickoff:'invalid'}),null);});

 test('replay briefing only uses received records and completion restores six categories',()=>{
 const data=demoOperationalFeeds(games[0]);const start=demoReplayFrame(data,0);assert.equal(start.records.length,0);assert.equal(start.high,0);assert.match(start.assessment,/not an assessment of the actual event/);
 const first=demoReplayFrame(data,1);assert.equal(first.high,1);assert.equal(first.medium,0);assert.equal(first.resolved,0);assert.doesNotMatch(first.decisions.join(' '),/cyber|airspace|document claim/i);
 const final=demoReplayFrame(data,100);assert.equal(final.records.length,6);assert.equal(final.medium,4);assert.equal(final.resolved,1);
 assert.equal(demoReplayFrame(data,NaN).count,0);
 });

test('event report follows received replay records without promoting them into real findings',()=>{
 for(const game of games){
  const snapshot={eventId:game.id,count:0,updatedAt:'2026-10-10T20:00:00Z'};
  const context={title:game.title,level:'event',games:[game],summaries:new Map(),replaySnapshot:snapshot};
  const start=buildScopeThreatReport(context);assert.equal(start.demoBriefing.count,0);assert.equal(start.demoBriefing.records.length,0);
  const first=buildScopeThreatReport({...context,replaySnapshot:{...snapshot,count:1}});assert.equal(first.demoBriefing.high,1);assert.equal(first.demoBriefing.medium,0);assert.equal(first.demoBriefing.records[0].eventId,game.id);assert.doesNotMatch(first.demoBriefing.decisions.join(' '),/cyber|airspace|document claim/i);
  const complete=buildScopeThreatReport({...context,replaySnapshot:{...snapshot,count:6}});assert.equal(complete.demoBriefing.records.length,6);assert.equal(complete.demoBriefing.resolved,1);
  for(const report of [start,first,complete]){assert.equal(report.findings.length,0);assert.equal(report.eventRollup.length,0);assert.equal(report.decisions.length,0);assert.equal(report.coverageGaps.length,0);}
 }
});

test('replay report rejects foreign game, invalid counts and geographic rollup scope',()=>{
 const context={title:'Scope',level:'event',games:[games[0]],summaries:new Map()};
 for(const replaySnapshot of [{eventId:games[1].id,count:6},{eventId:games[0].id,count:-1},{eventId:games[0].id,count:7},{eventId:games[0].id,count:1.5}])assert.equal(buildScopeThreatReport({...context,replaySnapshot}).demoBriefing,null);
 for(const level of ['national','region','state','venue'])assert.equal(buildScopeThreatReport({...context,level,replaySnapshot:{eventId:games[0].id,count:6}}).demoBriefing,null);
});
