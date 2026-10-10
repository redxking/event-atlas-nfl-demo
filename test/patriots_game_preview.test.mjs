import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectPatriotsGamePreview} from '../site/patriots_game_preview.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/patriots_game_preview.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872986');
const now=Date.parse(snapshot.checkedAt)+1000;

test('exact Patriots game receives bounded club claims in the published report',()=>{
  const selected=selectPatriotsGamePreview(game,snapshot,now);
  assert.equal(selected.state,'current_published_announcements');
  assert.equal(selected.claims.length,3);
  const bundle=buildNflEvidenceBundle(game,{schedule,patriotsGamePreview:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Patriots–Raiders club-announced ceremony and production/);
  assert.match(report,/Adam Vinatieri/);
  assert.match(report,/attendance.*unverified/i);
});

test('Patriots claims fail closed for another game, stale check, or mismatched venue',()=>{
  const other=schedule.games.find(item=>item.id!=='nfl:401872986');
  assert.equal(selectPatriotsGamePreview(other,snapshot,now).state,'outside_source_event');
  assert.equal(selectPatriotsGamePreview(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectPatriotsGamePreview({...game,venue:{...game.venue,id:'other'}},snapshot,now).state,'outside_source_event');
});
