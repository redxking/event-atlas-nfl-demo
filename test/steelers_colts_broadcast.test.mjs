import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSteelersColts} from '../site/steelers_colts_broadcast.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872985');
const sample=JSON.parse(readFileSync(new URL('../site/steelers_colts_broadcast.json',import.meta.url)));
const at=Date.parse(sample.checkedAt);

test('official Steelers article enters only the exact Colts game with unverified roles',()=>{
  assert.equal(sample.status,'ok');
  assert.equal(selectSteelersColts(game,sample,at+1000).state,'current_exact_game_article');
  assert.equal(selectSteelersColts({...game,id:'other'},sample,at+1000).state,'outside_source_event');
  assert.equal(selectSteelersColts(game,sample,at+13*3600000).state,'stale_or_unavailable');
  const bundle=buildNflEvidenceBundle(game,{schedule,steelersColtsBroadcast:sample},at+1000);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Steelers–Colts official game article/);
  assert.match(report,/J\.J\. Watt/);
  assert.match(report,/does not verify any named person on site/);
  assert.equal(bundle.picture.steelersContext.claims.length,4);
  assert.equal(buildNflEvidenceBundle(game,{schedule,steelersColtsBroadcast:{...sample,status:'failed'}},at+1000).picture.steelersContext.claims.length,0);
});
