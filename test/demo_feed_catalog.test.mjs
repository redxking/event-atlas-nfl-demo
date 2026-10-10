import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {demoFeedCatalog} from '../site/demo_feed_catalog.js';
import {buildScopeThreatReport} from '../site/scope_threat_report.js';
const scope=JSON.parse(fs.readFileSync('data/nfl_demo_window_scope.json'));
const games=JSON.parse(fs.readFileSync('site/nfl.json')).games.filter(g=>scope.frozenGameIds.includes(g.id));
const expected=['social','media','gathering','local-news','forum','channel','paste','partner','advisory','cad','pacs','visitor','dispatch','cti','dns','network','gis','aviation','hazard'];
test('every US window game has all requested feed types with distinct event-bound evidence',()=>{
 assert.equal(games.length,27);const ids=new Set();for(const game of games){const catalog=demoFeedCatalog(game);assert.deepEqual(catalog.records.map(r=>r.key),expected);assert.equal(new Set(catalog.records.map(r=>r.domain)).size,6);for(const r of catalog.records){assert.equal(r.eventId,game.id);assert.equal(r.classification,'Fictional demonstration');assert.ok(!ids.has(r.id));ids.add(r.id);assert.ok(Date.parse(r.observedAt)<Date.parse(game.kickoff));assert.ok(Object.keys(r.fields).length>=4);for(const field of ['assessment','owner','action','close'])assert.ok(r[field].trim());}}assert.equal(ids.size,513);
});
test('correlation evidence resolves within each game and does not fabricate corroboration',()=>{
 for(const game of games){const c=demoFeedCatalog(game);const ids=new Set(c.records.map(r=>r.id));assert.equal(c.correlations.length,4);for(const link of c.correlations){assert.ok(link.evidenceIds.length>=2);assert.ok(link.evidenceIds.every(id=>ids.has(id)));}assert.match(c.correlations[0].assessment,/No entry, infiltration or malicious intent/);assert.match(c.correlations[1].assessment,/insufficient to link/);assert.match(c.correlations[2].assessment,/one source/);assert.match(c.correlations[3].assessment,/not established/);}
});
test('examples avoid private location collection and document-address attribution; real reports remain separate',()=>{
 const game=games[0],c=demoFeedCatalog(game);assert.equal(c.records.find(r=>r.key==='channel').fields['Private locations'],'Not collected');assert.equal(c.records.find(r=>r.key==='dns').fields['Venue ownership'],'Not attributed');assert.match(c.records.find(r=>r.key==='gathering').assessment,/alone is not a threat/);assert.match(c.records.find(r=>r.key==='aviation').assessment,/not proof/);const report=buildScopeThreatReport({title:'Event',level:'event',games:[game],summaries:new Map()});assert.equal(report.findings.length,0);assert.equal(report.decisions.length,0);assert.equal(demoFeedCatalog({id:'bad',kickoff:'invalid'}),null);
});
