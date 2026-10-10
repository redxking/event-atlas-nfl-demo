import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateNashvillePoliceCount,selectNashvillePoliceCount,nashvillePoliceLayer} from '../site/nashville_police_aggregate.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872984');
const sample=JSON.parse(readFileSync(new URL('../site/nashville_police_count.json',import.meta.url)));
const at=Date.parse(sample.checkedAt);
const metadata=updated=>({name:'MetroNashvillePoliceDepartmentActiveDispatch',type:'Table',capabilities:'Query,Extract',editingInfo:{dataLastEditDate:updated}});

test('official citywide count can be zero and never imports individual calls',()=>{
  const zero=validateNashvillePoliceCount(metadata(at-60000),{count:0},at);
  assert.equal(zero.activeCount,0);
  assert.equal(zero.sourceUrl,nashvillePoliceLayer);
  assert.equal(JSON.stringify(zero).includes('Location'),false);
  assert.equal(selectNashvillePoliceCount(game,zero,at+1000).state,'current_citywide_count');
  assert.throws(()=>validateNashvillePoliceCount(metadata(at-31*60000),{count:0},at),/stale/);
  assert.throws(()=>validateNashvillePoliceCount(metadata(at-60000),{features:[{attributes:{Location:'street'}}]},at),/invalid/);
});

test('fresh Nashville count enters exact venue brief with citywide scope',()=>{
  assert.equal(sample.status,'ok');
  const selected=selectNashvillePoliceCount(game,sample,at+1000);
  assert.equal(selected.state,'current_citywide_count');
  assert.equal(selectNashvillePoliceCount({...game,venue:{...game.venue,id:'other'}},sample,at+1000).state,'outside_source_area');
  assert.equal(selectNashvillePoliceCount(game,sample,at+3*3600000).state,'stale_or_unavailable');
  const bundle=buildNflEvidenceBundle(game,{schedule,nashvillePoliceCount:sample},at+1000);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Nashville Police active major-dispatch citywide count/);
  assert.match(report,/not a stadium-area count/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now:at+1000});
  assert.equal(packet.evidence.find(item=>item.id==='I1')?.kind,'citywide_dispatch_aggregate');
  assert.equal(buildNflEvidenceBundle(game,{schedule,nashvillePoliceCount:{...sample,status:'failed'}},at+1000).picture.nashvillePoliceContext.activeCount,null);
});
