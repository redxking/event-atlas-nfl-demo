import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectChiefsGameCenter} from '../site/chiefs_game_center.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const schedule=JSON.parse(fs.readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(fs.readFileSync(new URL('../site/chiefs_game_center.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401873006');

test('Chiefs exact-game plan derives illustrative times and enters source-linked report',()=>{
  const now=Date.parse(snapshot.checkedAt)+60000;
  const selected=selectChiefsGameCenter(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,6);
  assert.equal(selected.claims.find(item=>item.id==='parking_open').plannedOpeningAt,'2026-10-18T15:55:00.000Z');
  assert.equal(selected.claims.find(item=>item.id==='stadium_gates').plannedOpeningAt,'2026-10-18T18:25:00.000Z');
  const bundle=buildNflEvidenceBundle(game,{schedule,chiefsGameCenter:snapshot},now);
  assert.equal(bundle.publicObservations.chiefsGameSpecificPlan.state,'current_published_plan');
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Chiefs–Chargers club-published event plan/);
  assert.match(report,/Illustrative opening 2026-10-18T15:55:00.000Z/);
  assert.match(report,/not observed parking, gate, tailgate or crowd conditions/);
});

test('stale, altered, and wrong-game plans do not become current event context',()=>{
  const now=Date.parse(snapshot.checkedAt)+13*3600000;
  assert.equal(selectChiefsGameCenter(game,snapshot,now).state,'stale_or_unavailable');
  const altered=structuredClone(snapshot);
  altered.claims[0].openingOffsetMinutes=-30;
  assert.equal(selectChiefsGameCenter(game,altered,Date.parse(snapshot.checkedAt)+60000).state,'stale_or_unavailable');
  assert.equal(selectChiefsGameCenter({...game,id:'nfl:other'},snapshot,Date.parse(snapshot.checkedAt)+60000).state,'outside_source_event');
});
