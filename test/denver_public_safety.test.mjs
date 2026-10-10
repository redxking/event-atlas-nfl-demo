import test from 'node:test';
import assert from 'node:assert/strict';
import {denverCrimeQueries,summarizeDenverCrimes} from '../site/denver_public_safety.js';

const now=Date.parse('2026-10-10T02:00:00Z');

test('Denver query requests only a crime-flagged, bounded historical spatial count and max date',()=>{
  const query=denverCrimeQueries({lat:39.743888888,lon:-105.02},now);
  const count=new URL(query.countUrl),latest=new URL(query.latestUrl);
  assert.equal(count.searchParams.get('returnCountOnly'),'true');
  assert.equal(count.searchParams.get('geometry'),'-105.02,39.743888888');
  assert.equal(count.searchParams.get('distance'),'5000');
  assert.match(count.searchParams.get('where'),/IS_CRIME = 1 AND REPORTED_DATE >= TIMESTAMP '2026-09-03 00:00:00' AND REPORTED_DATE < TIMESTAMP '2026-10-03 00:00:00'/);
  assert.equal(count.searchParams.has('outFields'),false);
  assert.match(latest.searchParams.get('outStatistics'),/"statisticType":"max"/);
  assert.equal(latest.searchParams.has('outFields'),false);
});

test('Denver aggregate retains only count and lag, rejecting source errors and future timestamps',()=>{
  const query=denverCrimeQueries({lat:39.743888888,lon:-105.02},now);
  const latest=now-26*3600000;
  const result=summarizeDenverCrimes({count:4800},{features:[{attributes:{latest}}]},query,now);
  assert.equal(result.status,'delayed_historical');
  assert.equal(result.nearby,4800);
  assert.equal(result.sourceLagHours,26);
  assert.equal(summarizeDenverCrimes({count:0},{features:[{attributes:{latest:now-15*86400000}}]},query,now).status,'stale_source');
  assert.throws(()=>summarizeDenverCrimes({error:{code:400}},{features:[{attributes:{latest}}]},query,now),/incomplete/);
  assert.throws(()=>summarizeDenverCrimes({count:1},{features:[{attributes:{latest:now+3600000}}]},query,now),/incomplete/);
});
