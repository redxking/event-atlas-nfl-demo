import test from 'node:test';
import assert from 'node:assert/strict';
import {arlingtonAggregateQueries,summarizeArlingtonAggregate} from '../site/arlington_police_aggregate.js';

const venue={id:'3687',lat:32.74728,lon:-97.09449};

test('Arlington connector requests only a spatial count and latest citywide update',()=>{
  const query=arlingtonAggregateQueries(venue);
  const count=new URL(query.countUrl),latest=new URL(query.latestUrl);
  assert.equal(count.searchParams.get('returnCountOnly'),'true');
  assert.equal(count.searchParams.get('distance'),'5000');
  assert.equal(count.searchParams.get('outFields'),null);
  assert.equal(count.searchParams.get('returnGeometry'),null);
  assert.equal(latest.searchParams.get('outFields'),'UpdatedDate');
  assert.equal(latest.searchParams.get('returnGeometry'),'false');
  assert.throws(()=>arlingtonAggregateQueries({...venue,id:'3798'}),/Arlington venue/);
});

test('Arlington aggregate rejects failed, malformed and stale source replies',()=>{
  const now=Date.parse('2026-10-10T06:00:00Z');
  const latest={features:[{attributes:{UpdatedDate:now-10*60000}}]};
  assert.deepEqual(summarizeArlingtonAggregate({count:26},latest,now),{nearby:26,radiusKm:5,sourceLatestAt:now-10*60000,sourceLagMinutes:10,checkedAt:now,status:'delayed_public_listing'});
  for(const count of [{count:-1},{count:'26'},{error:{message:'failed'}}])assert.throws(()=>summarizeArlingtonAggregate(count,latest,now));
  assert.throws(()=>summarizeArlingtonAggregate({count:0},{features:[{attributes:{UpdatedDate:now-4*3600000}}]},now),/stale/);
});
