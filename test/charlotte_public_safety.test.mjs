import test from 'node:test';
import assert from 'node:assert/strict';
import {charlotteIncidentQueries,summarizeCharlotteIncidents} from '../site/charlotte_public_safety.js';

const now=Date.parse('2026-10-09T20:00:00Z');

test('Charlotte query requests a bounded spatial count and latest report date only',()=>{
  const query=charlotteIncidentQueries({lat:35.225833333,lon:-80.852777777},now);
  const count=new URL(query.countUrl),latest=new URL(query.latestUrl);
  assert.equal(count.searchParams.get('returnCountOnly'),'true');
  assert.equal(count.searchParams.get('distance'),'5000');
  assert.equal(count.searchParams.get('geometry'),'-80.852777777,35.225833333');
  assert.match(count.searchParams.get('where'),/2026-10-01 00:00:00.*2026-10-08 00:00:00/);
  assert.ok(!count.searchParams.has('outFields'));
  assert.equal(latest.searchParams.get('outFields'),'DATE_REPORTED');
  assert.equal(latest.searchParams.get('returnGeometry'),'false');
  assert.equal(latest.searchParams.get('resultRecordCount'),'1');
});

test('Charlotte aggregate preserves source lag and rejects invalid results',()=>{
  const query=charlotteIncidentQueries({lat:35.225833333,lon:-80.852777777},now);
  const latest=now-45*3600000;
  const result=summarizeCharlotteIncidents({count:403},{features:[{attributes:{DATE_REPORTED:latest}}]},query,now);
  assert.equal(result.status,'delayed_historical');
  assert.equal(result.nearby,403);
  assert.equal(result.sourceLagHours,45);
  assert.equal(summarizeCharlotteIncidents({count:0},{features:[{attributes:{DATE_REPORTED:now-80*3600000}}]},query,now).status,'stale_source');
  assert.throws(()=>summarizeCharlotteIncidents({count:403,error:{code:400}},{features:[{attributes:{DATE_REPORTED:latest}}]},query,now),/incomplete/);
  assert.throws(()=>summarizeCharlotteIncidents({count:403},{features:[{attributes:{DATE_REPORTED:now+3600000}}]},query,now),/incomplete/);
});
