import test from 'node:test';
import assert from 'node:assert/strict';
import {massdotCameraQuery,parseMassdotCameraInventory} from '../lib/massdot_camera_inventory.mjs';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';

test('MassDOT staging inventory is metadata only and never grants a live camera claim',()=>{
  const query=new URL(massdotCameraQuery());
  assert.equal(query.origin,'https://gisstg.massdot.state.ma.us');
  assert.equal(query.searchParams.get('where'),"Status='In Service'");
  const features=Array.from({length:200},(_,index)=>({attributes:{OBJECTID:index+1,Status:'In Service',HOC_Display:`Road camera ${index+1}`},geometry:{x:index===0?-71.2105:-70.95,y:index===0?42.00005:42.35}}));
  const parsed=parseMassdotCameraInventory({features});
  const venue={id:'3738',address:'Foxborough, MA, USA',lat:42.090944444,lon:-71.264344444};
  const coverage=selectCameraCoverage([venue],parsed,[{id:'massdot-staging-cameras',status:'ok'}]);
  assert.equal(coverage['3738'].length,1);
  assert.equal(coverage['3738'][0].viewerKind,'directory_only');
  assert.equal(coverage['3738'][0].inService,null);
  assert.equal(coverage['3738'][0].videoUrl,undefined);
  assert.equal(coverage['3738'][0].stillUrl,undefined);
  assert.deepEqual(selectCameraCoverage([venue],parsed,[{id:'massdot-staging-cameras',status:'failed'}]),{});
  assert.throws(()=>parseMassdotCameraInventory({features:features.slice(0,199)}),/Incomplete/);
});
