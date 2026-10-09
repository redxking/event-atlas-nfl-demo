import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';

test('failed camera source leaves venue uncovered instead of reporting an empty inventory',()=>{
  const venue={id:'pittsburgh',address:'Pittsburgh, PA, USA',lat:40.4467,lon:-80.0158};
  const cameras=[{id:'camera-1',agency:'PennDOT GIS',lat:40.447,lon:-80.016}];
  assert.deepEqual(selectCameraCoverage([venue],cameras,[{id:'penndot-camera-inventory',status:'failed'}]),{});
  assert.equal(selectCameraCoverage([venue],cameras,[{id:'penndot-camera-inventory',status:'ok'}]).pittsburgh.length,1);
});
