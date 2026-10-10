import test from 'node:test';
import assert from 'node:assert/strict';
import {selectScopeChanges,changeInterpretation} from '../site/scope_changes.js';
import {buildScopeThreatReport} from '../site/scope_threat_report.js';
const now=Date.parse('2026-10-10T23:00:00Z');
const games=[{id:'a',title:'Game A',kickoff:'2026-10-11T17:00:00Z',venue:{id:'a',name:'Venue A'}},{id:'b',title:'Game B',kickoff:'2026-10-12T17:00:00Z',venue:{id:'b',name:'Venue B'}}];
const item={eventId:'a',eventTitle:'Wrong event title',kind:'forecast_changed',title:'Forecast changed',detail:'Source values differ',observedAt:'2026-10-10T22:00:00Z',sourceUrl:'https://weather.gov/source',reportUrl:'https://example.org/evidence',status:'unreviewed_source_change'};
const feed=items=>({schema:'event-atlas.published-change-feed.v1',status:'unreviewed_public_source_changes',builtAt:'2026-10-10T22:30:00Z',items});
test('scope selection uses selected event identity and excludes other events, duplicates, unsafe and future records',()=>{
 const selected=selectScopeChanges([games[0]],feed([item,item,{...item,eventId:'b'},{...item,sourceUrl:'javascript:alert(1)'},{...item,observedAt:'2026-10-11T00:00:00Z'},{...item,observedAt:'2026-09-01T00:00:00Z'}]),now);
 assert.equal(selected.items.length,1);assert.equal(selected.items[0].eventTitle,'Game A');assert.equal(selected.items[0].venue,'Venue A');assert.equal(selected.items[0].category,'Forecast revision');assert.match(selected.items[0].meaning,/not an observed hazard/);
 assert.equal(selectScopeChanges(games,feed([item,{...item,eventId:'b'}]),now).items.length,2);
});
test('missing and stale history cannot establish no changes, while a current empty bounded history is explicit',()=>{
 assert.equal(selectScopeChanges(games,null,now).state,'unavailable');const stale=selectScopeChanges(games,{...feed([item]),builtAt:'2026-10-09T00:00:00Z'},now);assert.equal(stale.state,'stale');assert.equal(stale.items.length,0);assert.match(stale.note,/cannot establish/);const empty=selectScopeChanges(games,feed([]),now);assert.equal(empty.state,'available');assert.match(empty.note,/not proof/);
});
test('coverage, disappeared records and relationship changes retain different meanings and do not add threat findings',()=>{
 assert.match(changeInterpretation('source_status_changed').meaning,/not a change in threat severity/);assert.match(changeInterpretation('city_index_item_unlisted').meaning,/resolution and safety are not established/);assert.match(changeInterpretation('road_event_relationship_reclassified').meaning,/source condition itself may be unchanged/);
 const report=buildScopeThreatReport({title:'US',level:'national',games,summaries:new Map(),changeFeed:feed([{...item,kind:'source_status_changed'},{...item,kind:'city_index_item_unlisted'}])},new Date(now));assert.equal(report.findings.length,0);assert.equal(report.decisions.length,0);assert.equal(report.changes.items.length,2);assert.match(report.sections.find(s=>s.heading==='Changes affecting this briefing').paragraphs.join(' '),/not incident occurrence/);
});
test('source clock, detail and links are preserved without promoting a lost record to a retraction',()=>{
 const selected=selectScopeChanges(games,feed([{...item,kind:'city_event_notice_unmatched',title:'record_unmatched',reportUrl:'data:text/html,unsafe'}]),now);assert.equal(selected.items[0].observedAt,item.observedAt);assert.equal(selected.items[0].reportUrl,null);assert.equal(selected.items[0].sourceUrl,item.sourceUrl);assert.doesNotMatch(selected.items[0].title,/_/);assert.match(selected.items[0].next,/before closing/);
});
