import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectHoustonActiveIncidents} from '../site/houston_active_incidents.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401873016');
const sample=JSON.parse(readFileSync(new URL('../site/houston_active_incidents.json',import.meta.url)));
const at=Date.parse(sample.checkedAt);

test('Houston citywide count enters only Reliant reports and fails closed when stale',()=>{
  assert.ok(game);
  assert.equal(sample.status,'ok');
  assert.equal(selectHoustonActiveIncidents(game,sample,at+1000).state,'current_citywide_count');
  assert.equal(selectHoustonActiveIncidents({...game,venue:{...game.venue,id:'other'}},sample,at+1000).state,'outside_source_area');
  assert.equal(selectHoustonActiveIncidents(game,sample,at+3*3600000).state,'stale_or_unavailable');
  assert.equal(selectHoustonActiveIncidents(game,{...sample,totalCount:sample.totalCount+1},at+1000).state,'stale_or_unavailable');
  const bundle=buildNflEvidenceBundle(game,{schedule,houstonActiveIncidents:sample},at+1000);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Houston citywide active-incident count/);
  assert.match(report,/citywide rows at retrieval/);
  assert.equal(bundle.publicObservations.houstonCitywideActiveIncidents.totalCount,sample.totalCount);
  assert.equal(JSON.stringify(bundle.publicObservations.houstonCitywideActiveIncidents).includes('Address'),false);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now:at+1000});
  assert.equal(packet.evidence.find(item=>item.id==='HOU1')?.kind,'citywide_dispatch_aggregate');
  assert.equal(buildNflEvidenceBundle(game,{schedule,houstonActiveIncidents:{...sample,status:'failed'}},at+1000).picture.houstonActiveContext.totalCount,null);
});
