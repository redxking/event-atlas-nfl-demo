import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectNolaReadyActive} from '../site/nola_ready_active.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {buildPublishedReportState} from '../site/published_report_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/nola_ready_active.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Date.parse(snapshot.checkedAt)+1000;

test('city active index enters near-term Saints report as discovery context',()=>{
  const selected=selectNolaReadyActive(game,snapshot,now);
  assert.equal(selected.state,'current_index');
  assert.deepEqual(selected.entries.map(item=>item.title),['National Fried Chicken Festival 2026','Crescent City Blues & BBQ Festival 2026']);
  const bundle=buildNflEvidenceBundle(game,{schedule,nolaReadyActive:snapshot},now);
  assert.equal(bundle.picture.sources.find(item=>item.name==='NOLA Ready active incident index')?.state,'current_index');
  const report=buildNflPublicReport(bundle);
  assert.match(report,/National Fried Chicken Festival 2026/);
  assert.match(report,/listing alone does not establish dates, location, severity, stadium relevance, or a threat/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K7')?.sourceUrl,snapshot.sourceUrl);
});

test('stale or malformed index cannot be used as current city discovery',()=>{
  assert.equal(selectNolaReadyActive(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
  const malformed={...snapshot,entries:[{id:'bad',title:'Bad',url:'https://example.com/'}]};
  assert.equal(selectNolaReadyActive(game,malformed,now).state,'stale_or_unavailable');
  const other=schedule.games.find(item=>item.venue.id!==game.venue.id);
  assert.equal(selectNolaReadyActive(other,snapshot,now).state,'outside_near_term_city_scope');
});

test('new city index listing survives published comparison and yields review notice',()=>{
  const beforeBundle=buildNflEvidenceBundle(game,{schedule,nolaReadyActive:snapshot},now);
  const prior=buildPublishedReportState(beforeBundle,game,null,null,now);
  const later=now+3600000;
  const entry={id:'new-city-notice',title:'New city notice',url:'https://ready.nola.gov/incident/new-city-notice/'};
  const revised={...snapshot,checkedAt:new Date(later-1000).toISOString(),entries:[...snapshot.entries,entry]};
  const afterBundle=buildNflEvidenceBundle(game,{schedule,nolaReadyActive:revised},later);
  const next=buildPublishedReportState(afterBundle,game,null,prior,later);
  assert.equal(next.changes.find(item=>item.kind==='city_index_item_added')?.sourceUrl,entry.url);
});
