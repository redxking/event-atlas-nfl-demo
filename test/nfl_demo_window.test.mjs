import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('frozen two-week NFL demo covers every current game and exposes international limits',async()=>{
  const scope=JSON.parse(await fs.readFile(new URL('../data/nfl_demo_window_scope.json',import.meta.url)));
  const window=JSON.parse(await fs.readFile(new URL('../site/nfl_demo_window.json',import.meta.url)));
  assert.equal(Date.parse(scope.endsBefore)-Date.parse(scope.startsAt),14*86400000);
  assert.equal(new Set(window.games.map(game=>game.id)).size,window.games.length);
  assert.equal(window.counts.total,window.games.length);
  assert.equal(window.counts.us+window.counts.international,window.counts.total);
  const drift=window.reconciliation;
  assert.equal(drift.state,drift.entered.length||drift.left.length||drift.kickoffChanged.length||drift.crosswalkMismatch.length?'review_required':'matches_frozen_scope');
  assert.deepEqual(new Set(drift.entered),new Set(window.games.map(game=>game.id).filter(id=>!scope.frozenGameIds.includes(id))));
  assert.deepEqual(new Set(drift.left),new Set(scope.frozenGameIds.filter(id=>!window.games.some(game=>game.id===id))));
  for(const game of window.games){
    const kickoff=Date.parse(game.kickoff);
    assert.ok(kickoff>=Date.parse(scope.startsAt)&&kickoff<Date.parse(scope.endsBefore));
    if(scope.frozenKickoffs[game.id]!==undefined&&scope.frozenKickoffs[game.id]!==game.kickoff)assert.ok(drift.kickoffChanged.some(change=>change.id===game.id));
    assert.match(game.nflWeekUrl,/^https:\/\/www\.nfl\.com\/schedules\/2026\/by-week\/week-(?:[1-9]|1[0-8])$/);
    if(game.geographicScope==='international_schedule_only'){
      assert.notEqual(game.venue.country,'USA');
      assert.equal(game.coverageState,'us_feeds_out_of_scope');
      assert.equal(game.reportUrl,null);
    }else{
      assert.equal(game.geographicScope,'us_venue_context');
      assert.match(game.reportUrl,/^reports\/nfl-\d+\.html$/);
    }
  }
});
