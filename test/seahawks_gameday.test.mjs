import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectSeahawksGameday} from '../site/seahawks_gameday.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/seahawks_gameday.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872992');
const now=Date.parse(snapshot.checkedAt)+1000;

test('exact Seahawks game receives club plans and keeps FAA event listing distinct',()=>{
  const selected=selectSeahawksGameday(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,7);
  const airspace={builtAt:new Date(now).toISOString(),sourceItemUrl:'https://faasysops.maps.arcgis.com/home/item.html?id=9f246af52c4049b99b50a2b97e2e5b2c',byGame:{[game.id]:{eventName:'San Francisco 49ers @ Seattle Seahawks',venueName:'Lumen Field',status:'SCHEDULED',startAt:'2026-10-11T19:25:00Z',endAt:'2026-10-11T23:25:00Z'}}};
  const bundle=buildNflEvidenceBundle(game,{schedule,seahawksGameday:snapshot,airspace},now);
  assert.equal(bundle.picture.clubAviationContext.state,'club_plan_and_faa_event_record');
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Seahawks–49ers club-published game-day guide/);
  assert.match(report,/Mateo Lopez/);
  assert.match(report,/Allen Stone/);
  assert.match(report,/C-17 Globemaster III/);
  assert.match(report,/Neither verifies a flown aircraft/);
});

test('Seahawks guide refuses other games, stale checks, and mismatched venues',()=>{
  assert.equal(selectSeahawksGameday(schedule.games.find(item=>item.id!=='nfl:401872992'),snapshot,now).state,'outside_source_event');
  assert.equal(selectSeahawksGameday(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectSeahawksGameday({...game,venue:{...game.venue,id:'other'}},snapshot,now).state,'outside_source_event');
});
