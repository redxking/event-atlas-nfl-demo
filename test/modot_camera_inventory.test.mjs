import test from 'node:test';
import assert from 'node:assert/strict';
import {modotCameraQuery,parseModotCameraInventory} from '../lib/modot_camera_inventory.mjs';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';
import fs from 'node:fs';

const feature=(id,lat,lon,description='I-70 at Stadium Drive')=>({
  attributes:{CAM_ID:id,DESCRIPTION:description},geometry:{x:lon,y:lat}
});

test('MoDOT query is bounded to Kansas City and requests metadata plus geometry',()=>{
  const url=new URL(modotCameraQuery());
  assert.equal(url.hostname,'mapping.modot.mo.gov');
  assert.equal(url.searchParams.get('outFields'),'CAM_ID,DESCRIPTION');
  assert.equal(url.searchParams.get('returnGeometry'),'true');
  assert.deepEqual(JSON.parse(url.searchParams.get('geometry')),{xmin:-94.8,ymin:38.8,xmax:-94.2,ymax:39.3,spatialReference:{wkid:4326}});
});

test('MoDOT metadata provides only an official map link and covers Arrowhead when the source succeeds',()=>{
  const records=parseModotCameraInventory({features:[
    feature(6300,39.054,-94.475),
    feature(6300,39.054,-94.475),
    feature(1,40,-94.475),
    feature(2,39.05,-94.48,'Another nearby road camera')
  ]});
  assert.equal(records.length,2);
  assert.equal(records[0].agency,'MoDOT Traveler Information');
  assert.equal(new URL(records[0].viewerUrl).hostname,'traveler.modot.org');
  assert.equal(records[0].videoUrl,undefined);
  assert.equal(records[0].stillUrl,undefined);
  const venue={id:'arrowhead',address:'Kansas City, MO, USA',lat:39.0489,lon:-94.4839};
  const source=[{id:'modot-kansas-city-cameras',status:'ok'}];
  assert.equal(selectCameraCoverage([venue],records,source).arrowhead.length,2);
  assert.deepEqual(selectCameraCoverage([venue],records,[{...source[0],status:'failed'}]),{});
});

test('MoDOT parser rejects incomplete replies',()=>{
  assert.throws(()=>parseModotCameraInventory({error:{message:'denied'}}));
  assert.throws(()=>parseModotCameraInventory({features:[],exceededTransferLimit:true}));
  assert.throws(()=>parseModotCameraInventory({features:null}));
});

test('saved Arrowhead snapshot contains source-linked nearby metadata without playable media',()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('../site/cameras.json',import.meta.url)));
  const source=snapshot.sources.find(item=>item.id==='modot-kansas-city-cameras');
  assert.equal(source?.status,'ok');
  const items=snapshot.byVenue?.['3622'];
  assert.ok(items?.length>0);
  assert.ok(items.every(item=>item.agency==='MoDOT Traveler Information'&&item.distanceKm<=15));
  assert.ok(items.every(item=>!item.videoUrl&&!item.stillUrl));
});
