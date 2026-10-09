import test from 'node:test';
import assert from 'node:assert/strict';
import {indianapolisCfsQueries,summarizeIndianapolisCfs} from '../site/indianapolis_public_safety.js';

const now=Date.parse('2026-10-09T20:00:00Z');

test('Indianapolis query requests only a bounded count and a publisher lag timestamp',()=>{
  const query=indianapolisCfsQueries({lat:39.760056,lon:-86.163806},now);
  const url=new URL(query.countUrl);
  assert.equal(url.searchParams.get('returnCountOnly'),'true');
  assert.equal(url.searchParams.get('distance'),'5000');
  assert.equal(url.searchParams.get('geometry'),'-86.163806,39.760056');
  assert.match(url.searchParams.get('where'),/2026-10-01 00:00:00.*2026-10-08 00:00:00/);
  assert.ok(!url.searchParams.has('outFields'));
  assert.match(new URL(query.latestUrl).searchParams.get('outStatistics'),/RecDateTime/);
});

test('Indianapolis aggregate preserves lag and rejects incomplete results',()=>{
  const query=indianapolisCfsQueries({lat:39.760056,lon:-86.163806},now);
  const latest=now-30*3600000;
  const result=summarizeIndianapolisCfs({count:123},{features:[{attributes:{latest}}]},query,now);
  assert.equal(result.status,'delayed_historical');
  assert.equal(result.nearby,123);
  assert.equal(result.sourceLagHours,30);
  assert.equal(summarizeIndianapolisCfs({count:123},{features:[{attributes:{latest:now-80*3600000}}]},query,now).status,'stale_source');
  assert.throws(()=>summarizeIndianapolisCfs({count:123,error:{code:400}},{features:[{attributes:{latest}}]},query,now),/incomplete/);
  assert.throws(()=>summarizeIndianapolisCfs({count:123},{features:[{attributes:{latest:now+3600000}}]},query,now),/incomplete/);
});
