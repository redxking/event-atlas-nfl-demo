import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldAdoptPublishedSnapshot} from '../site/published_snapshot_refresh.js';

test('open brief adopts newer valid published snapshots and rejects rollback',()=>{
  const current={builtAt:'2026-10-09T19:00:00Z',byVenue:{a:[]}};
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'2026-10-09T20:00:00Z',byVenue:{a:[]}},'byVenue'),true);
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'2026-10-09T18:00:00Z',byVenue:{a:[]}},'byVenue'),false);
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'2026-10-09T20:00:00Z'},'byVenue'),false);
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'invalid',byVenue:{}},'byVenue'),false);
});
