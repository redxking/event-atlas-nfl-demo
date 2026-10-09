import test from 'node:test';
import assert from 'node:assert/strict';
import {chicagoCrimeQuery,summarizeChicagoCrimes} from '../site/chicago_public_safety.js';

test('Chicago query excludes the recent reporting lag and returns only an area aggregate',()=>{
  const query=chicagoCrimeQuery({lat:41.8625,lon:-87.6167},Date.parse('2026-10-09T20:00:00Z'));
  assert.equal(query.start,'2026-09-01');
  assert.equal(query.end,'2026-10-01');
  const url=new URL(query.url);
  assert.equal(url.searchParams.get('$select'),'count(*) as count');
  assert.match(url.searchParams.get('$where'),/within_circle\(location, 41\.8625, -87\.6167, 5000\)/);
  assert.doesNotMatch(query.url,/outFields|case_number|block/);
  assert.deepEqual(summarizeChicagoCrimes([{count:'83'}],query,1),{nearby:83,start:'2026-09-01',end:'2026-10-01',radiusKm:5,checkedAt:1});
  assert.throws(()=>summarizeChicagoCrimes([],query,1),/incomplete/);
});
