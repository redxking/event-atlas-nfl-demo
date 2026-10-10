import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {demoOperationalFeeds} from '../site/demo_operational_feeds.js';
import {buildScopeThreatReport} from '../site/scope_threat_report.js';
const scope=JSON.parse(fs.readFileSync('data/nfl_demo_window_scope.json'));
const nfl=JSON.parse(fs.readFileSync('site/nfl.json'));
const games=nfl.games.filter(g=>scope.frozenGameIds.includes(g.id));
test('all 27 US window games have six typed fictional records bound to the correct event',()=>{
 assert.equal(games.length,27);const ids=new Set();for(const game of games){const demo=demoOperationalFeeds(game);assert.equal(demo.records.length,6);assert.equal(new Set(demo.records.map(r=>r.category)).size,6);for(const r of demo.records){assert.equal(r.eventId,game.id);assert.match(r.classification,/Fictional/);assert.ok(Number.isFinite(Date.parse(r.observedAt)));assert.ok(Object.keys(r.fields).length>=4);assert.ok(!ids.has(r.id));ids.add(r.id);}}
});
test('briefing keeps lead claims, sensor identity gaps and resolved credentials distinct',()=>{const demo=demoOperationalFeeds(games[0]);assert.match(demo.briefing.assessment,/do not independently corroborate/);assert.match(demo.briefing.resolved,/should not remain an active/);assert.match(demo.records.find(r=>r.key==='aviation').assessment,/does not prove/);assert.match(demo.records.find(r=>r.key==='cyber').fields['Example host'],/\.invalid$/);});
test('fixtures do not populate real findings or counts',()=>{const report=buildScopeThreatReport({title:'Event',level:'event',games:[games[0]],summaries:new Map()});assert.equal(report.findings.length,0);assert.equal(report.decisions.length,0);assert.equal(demoOperationalFeeds({id:'bad',kickoff:'invalid'}),null);});
