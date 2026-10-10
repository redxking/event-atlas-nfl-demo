import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScopeThreatReport} from '../site/scope_threat_report.js';
const games=[{id:'a',title:'Game A',venue:{id:'1',name:'Venue 1'},kickoff:'2026-10-11T17:00:00Z'},{id:'b',title:'Game B',venue:{id:'2',name:'Venue 2'},kickoff:'2026-10-12T17:00:00Z'}];
const cue={sourceUrl:'https://example.com/warning',trigger:'Weather warning',sourceAt:'2026-10-10T12:00:00Z',domain:'weather alert',basis:'Verify the warning area.'};
const summary={label:'1 concern',items:[cue],urgent:[cue]};
test('decision briefs retain conditional consequences and authority rather than asserting impact',()=>{const road={...cue,domain:'road access',trigger:'Published road closure',action:'Check the listed segment.'};const report=buildScopeThreatReport({title:'Game A',level:'event',games:[games[0]],summaries:new Map([['a',{...summary,items:[road],urgent:[]} ]])});assert.equal(report.decisions.length,1);assert.match(report.decisions[0].impact,/If the listed segment/);assert.match(report.decisions[0].escalate,/road authority confirms/);assert.match(report.decisions[0].close,/verified diversion/);assert.match(report.sections[2].paragraphs[0],/Check the listed segment/);assert.equal(report.decisions[0].finding.sourceUrl,road.sourceUrl);});
test('deduplicates shared reports while retaining affected games and scope',()=>{const summaries=new Map([['a',summary],['b',summary]]);const all=buildScopeThreatReport({title:'United States',level:'national',games,summaries});assert.equal(all.findings.length,1);assert.equal(all.findings[0].games.length,2);assert.match(all.sections[0].paragraphs[1],/linked to 2 events/);const local=buildScopeThreatReport({title:'Venue 1',level:'venue',games:[games[0]],summaries});assert.equal(local.findings[0].games.length,1);assert.doesNotMatch(JSON.stringify(local),/Game B/);});
test('missing screening does not become an all clear or a fictional threat',()=>{const report=buildScopeThreatReport({title:'Game A',level:'event',games:[games[0]],summaries:new Map()});assert.equal(report.findings.length,0);assert.match(report.sections[3].paragraphs[0],/1 is awaiting screening/);assert.match(report.sections[0].paragraphs[1],/no conclusion.*safe/);assert.doesNotMatch(JSON.stringify(report),/Elena|Unknown sender/);});
test('unsafe URLs are not rendered as findings and empty scopes are explicit',()=>{const invalid={...summary,items:[{...cue,sourceUrl:'javascript:alert(1)'}]};assert.equal(buildScopeThreatReport({title:'Test',level:'state',games:[games[0]],summaries:new Map([['a',invalid]])}).findings.length,0);const empty=buildScopeThreatReport({title:'Empty',level:'region',games:[],summaries:new Map()});assert.match(empty.sections[0].paragraphs[1],/No scheduled events/);});

test('repeated cues in one game do not duplicate its affected-event entry',()=>{const report=buildScopeThreatReport({title:'Test',level:'event',games:[games[0]],summaries:new Map([['a',{...summary,items:[cue,cue]}]])});assert.equal(report.findings[0].games.length,1);});

test('rollup identifies actual venues, decisions and unavailable sources',()=>{const report=buildScopeThreatReport({title:'Region',level:'region',games,summaries:new Map([['a',{...summary,sources:[{name:'NWS alerts',state:'source failed',detail:'Connection unavailable'}]}]])});assert.equal(report.eventRollup.length,1);assert.equal(report.eventRollup[0].game.id,'a');assert.equal(report.eventRollup[0].priority,'Prompt weather review');assert.match(report.sections[1].paragraphs.join(' '),/Venue 1/);assert.match(report.sections[3].paragraphs.join(' '),/NWS alerts: source failed for Game A/);assert.doesNotMatch(report.sections[1].paragraphs.join(' '),/Venue 2/);});

test('related access findings form one venue decision without losing source records',()=>{
 const roads=[{...cue,sourceId:'r1',domain:'road access',trigger:'Road A',action:'Confirm Road A'},{...cue,sourceId:'r2',domain:'pregame access',trigger:'Road B',action:'Confirm Road B'}];
 const report=buildScopeThreatReport({title:'Event',level:'event',games:[games[0]],summaries:new Map([['a',{label:'2 concerns',items:roads,urgent:[]} ]])});
 assert.equal(report.findings.length,2);assert.equal(report.decisions.length,1);
 assert.deepEqual(report.decisions[0].evidenceNumbers,[1,2]);assert.deepEqual(report.decisions[0].verificationSteps,['Confirm Road A','Confirm Road B']);
 assert.match(report.decisions[0].interpretation,/do not establish independent corroboration/);
});
test('regional coordination keeps different venue decisions and weather tasks separate',()=>{
 const road={...cue,sourceId:'r1',domain:'road access'};
 const weather={...cue,sourceId:'w1'};
 const report=buildScopeThreatReport({title:'Region',level:'region',games,summaries:new Map([['a',{label:'2 concerns',items:[road,weather],urgent:[weather]}],['b',{label:'1 concern',items:[road],urgent:[]} ]])});
 assert.equal(report.findings.length,2);assert.equal(report.decisions.length,3);
 assert.ok(report.decisions.every(d=>d.games.every(g=>g.venue.id===d.venue.id)));
});
test('same venue across dates shares one task while retaining both game identities',()=>{
 const atSameVenue={...games[1],venue:games[0].venue};
 const report=buildScopeThreatReport({title:'Venue',level:'venue',games:[games[0],atSameVenue],summaries:new Map([['a',summary],['b',summary]])});
 assert.equal(report.decisions.length,1);assert.equal(report.decisions[0].games.length,2);assert.equal(report.decisions[0].findings.length,1);
});
