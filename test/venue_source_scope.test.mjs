import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraSourceIdsForVenue,failedSourcesForVenue,roadSourceIdsForVenue} from '../site/venue_source_scope.js';

test('venue camera and road failures are scoped to their own publishers',()=>{
  const saints={address:'New Orleans, LA, USA',lat:29.9509,lon:-90.0812};
  const sources=[{id:'txdot-dfw-camera-assets',status:'failed'},{id:'la511-public-cameras',status:'ok'}];
  assert.deepEqual(cameraSourceIdsForVenue(saints),['la511-public-cameras']);
  assert.deepEqual(failedSourcesForVenue(saints,sources,'camera'),[]);
  assert.deepEqual(failedSourcesForVenue(saints,[...sources,{id:'la511-public-cameras',status:'failed'}],'camera').map(item=>item.id),['la511-public-cameras']);
  assert.deepEqual(roadSourceIdsForVenue(saints),['ladotd-511-new-orleans']);
});

test('California districts and Dallas area do not claim another source failure',()=>{
  assert.deepEqual(cameraSourceIdsForVenue({address:'Santa Clara, CA, USA',lat:37.4,lon:-121.9}),['caltrans-d4']);
  assert.deepEqual(roadSourceIdsForVenue({address:'Inglewood, CA, USA',lat:33.95,lon:-118.35}),['caltrans-lcs-d7']);
  assert.deepEqual(cameraSourceIdsForVenue({address:'Houston, TX, USA',lat:29.76,lon:-95.36}),[]);
  assert.deepEqual(cameraSourceIdsForVenue({address:'Arlington, TX, USA',lat:32.747,lon:-97.095}),['txdot-dfw-camera-assets']);
});
