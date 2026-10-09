import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';

test('failed camera source leaves venue uncovered instead of reporting an empty inventory',()=>{
  const venue={id:'pittsburgh',address:'Pittsburgh, PA, USA',lat:40.4467,lon:-80.0158};
  const cameras=[{id:'camera-1',agency:'PennDOT GIS',lat:40.447,lon:-80.016}];
  assert.deepEqual(selectCameraCoverage([venue],cameras,[{id:'penndot-camera-inventory',status:'failed'}]),{});
  assert.equal(selectCameraCoverage([venue],cameras,[{id:'penndot-camera-inventory',status:'ok'}]).pittsburgh.length,1);
});

test('Maryland iMAP inventory can cover a venue when the CHART endpoint fails',()=>{
  const venue={id:'baltimore',address:'Baltimore, MD, USA',lat:39.278,lon:-76.622};
  const cameras=[{id:'md-imap-42',agency:'Maryland CHART',lat:39.28,lon:-76.62}];
  const sources=[{id:'md-chart-cameras',status:'failed'},{id:'md-imap-cameras',status:'ok'}];
  assert.equal(selectCameraCoverage([venue],cameras,sources).baltimore.length,1);
});
