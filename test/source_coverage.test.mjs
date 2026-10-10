import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCoverageGap} from '../site/source_coverage.js';
import {attentionSummary} from '../site/attention_summary.js';
import {rollup} from '../site/geographic_explorer.js';
import {buildScopeThreatReport} from '../site/scope_threat_report.js';
const games=[{id:'a',title:'Game A',kickoff:'2026-10-11T17:00:00Z',venue:{id:'a',name:'Venue A'}},{id:'b',title:'Game B',kickoff:'2026-10-12T17:00:00Z',venue:{id:'b',name:'Venue B'}}];
test('applicable failed, missing, limited and forecast-gap sources are explicit without treating other jurisdictions as gaps',()=>{
 for(const state of ['source failed','stale_or_unavailable','no connector','no_coverage','not yet loaded','not screenable','outside forecast window','not verified','partial','publisher directory only','unknown'])assert.ok(sourceCoverageGap({state}),state);
 for(const state of ['outside source area','outside_source_city','outside source jurisdiction','outside_source_event','checked','no spatial match in snapshot','0 regional point candidates','current forecast'])assert.equal(sourceCoverageGap({state}),null,state);
});
test('absent queue remains pending through overview and report, while an empty completed queue remains available',()=>{
 const pending=attentionSummary({});assert.equal(pending.label,'Monitoring not started');assert.equal(pending.screeningState,'pending');assert.equal(pending.items.length,0);
 const available=attentionSummary({reviewQueue:{state:'no_time_screened_cues',items:[]}});assert.equal(available.screeningState,'available');
 const summaries=new Map([['a',pending],['b',available]]);assert.equal(rollup(games,summaries).pending,1);const report=buildScopeThreatReport({title:'US',level:'national',games,summaries});assert.match(report.sections[3].paragraphs[0],/1 is awaiting screening/);assert.equal(report.findings.length,0);
});
test('same feed at different source locations preserves each gap link; repeated exact gap groups its events',()=>{
 const a={name:'NWS alerts',state:'no_coverage',sourceUrl:'https://api.weather.gov/alerts?point=1,1',detail:'Point check'},b={...a,sourceUrl:'https://api.weather.gov/alerts?point=2,2'};
 const make=sources=>({label:'No flagged concerns',items:[],urgent:[],sources});const distinct=buildScopeThreatReport({title:'US',level:'national',games,summaries:new Map([['a',make([a])],['b',make([b])]])});assert.equal(distinct.coverageGaps.length,2);assert.deepEqual(distinct.coverageGaps.map(g=>g.games),[['Game A'],['Game B']]);assert.equal(distinct.findings.length,0);
 const repeated=buildScopeThreatReport({title:'US',level:'national',games,summaries:new Map([['a',make([a])],['b',make([a])]])});assert.equal(repeated.coverageGaps.length,1);assert.deepEqual(repeated.coverageGaps[0].games,['Game A','Game B']);
});
test('unsafe gap URLs are withheld without losing the unknown-source explanation',()=>{const report=buildScopeThreatReport({title:'Event',level:'event',games:[games[0]],summaries:new Map([['a',{label:'No flagged concerns',items:[],urgent:[],sources:[{name:'Agency feed',state:'no connector',sourceUrl:'javascript:alert(1)'}]}]])});assert.equal(report.coverageGaps[0].sourceUrl,null);assert.match(report.sections[3].paragraphs.join(' '),/Agency feed: no connector/);assert.equal(report.findings.length,0);});
