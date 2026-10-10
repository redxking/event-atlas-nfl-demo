import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldAdoptPublishedSnapshot,validPublishedSnapshotValue} from '../site/published_snapshot_refresh.js';

test('open brief adopts newer valid published snapshots and rejects rollback',()=>{
  const current={builtAt:'2026-10-09T19:00:00Z',byVenue:{a:[]}};
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'2026-10-09T20:00:00Z',byVenue:{a:[]}},'byVenue'),true);
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'2026-10-09T18:00:00Z',byVenue:{a:[]}},'byVenue'),false);
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'2026-10-09T20:00:00Z'},'byVenue'),false);
  assert.equal(shouldAdoptPublishedSnapshot(current,{builtAt:'invalid',byVenue:{}},'byVenue'),false);
});

test('a zero public aggregate remains a valid dated snapshot',()=>{
  const current={checkedAt:'2026-10-09T19:00:00Z',nearbyCount:4};
  const next={checkedAt:'2026-10-09T20:00:00Z',nearbyCount:0};
  assert.equal(validPublishedSnapshotValue(next,'nearbyCount','nonnegative_integer'),true);
  assert.equal(shouldAdoptPublishedSnapshot(current,next,'nearbyCount','checkedAt','nonnegative_integer'),true);
  assert.equal(validPublishedSnapshotValue({...next,nearbyCount:-1},'nearbyCount','nonnegative_integer'),false);
});
