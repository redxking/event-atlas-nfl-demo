import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCoverage} from '../site/coverage_summary.js';

const now=Date.parse('2026-10-09T18:00:00Z');
const games=[
  {venue:{id:'a',name:'Alpha Field',address:'A, NY, USA',lat:42,lon:-78}},
  {venue:{id:'a',name:'Alpha Field',address:'A, NY, USA',lat:42,lon:-78}},
  {venue:{id:'b',name:'Bravo Field',address:'B, PA, USA',lat:40,lon:-80}}
];

test('coverage is venue based and separates connected from absent feeds',()=>{
  const camera={builtAt:'2026-10-09T17:00:00Z',sources:[{id:'one',status:'ok'}],byVenue:{b:[]}};
  const road={builtAt:'2026-10-09T17:00:00Z',sources:[{id:'two',status:'failed'}],byVenue:{}};
  const result=summarizeCoverage(games,camera,road,now);
  assert.equal(result.total,2);
  assert.equal(result.points,2);
  assert.equal(result.cameras,1);
  assert.equal(result.roads,0);
  assert.equal(result.rows[0].camera,'not_connected');
  assert.equal(result.rows[1].camera,'connected');
  assert.deepEqual(result.roadFailed,['two']);
});

test('stale and unavailable snapshots never count as current coverage',()=>{
  const stale={builtAt:'2026-10-08T00:00:00Z',byVenue:{a:[{}],b:[]}};
  const result=summarizeCoverage(games,stale,null,now);
  assert.equal(result.cameras,0);
  assert.equal(result.roads,0);
  assert.ok(result.rows.every(row=>row.camera==='stale'&&row.road==='unavailable'));
});

test('a configured but failed Maryland source is not mislabeled as no connector',()=>{
  const maryland=[{venue:{id:'md',name:'Maryland Field',address:'Baltimore, MD, USA',lat:39,lon:-76}}];
  const camera={builtAt:'2026-10-09T17:00:00Z',sources:[{id:'md-chart-cameras',status:'failed'}],byVenue:{}};
  const road={builtAt:'2026-10-09T17:00:00Z',sources:[{id:'md-chart-incidents',status:'failed'},{id:'md-chart-closures',status:'failed'}],byVenue:{}};
  const result=summarizeCoverage(maryland,camera,road,now);
  assert.equal(result.rows[0].camera,'source_failed');
  assert.equal(result.rows[0].road,'source_failed');
  assert.equal(result.cameras,0);
  assert.equal(result.roads,0);
});
