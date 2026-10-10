import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTxdotCameraInventory,txdotCameraQuery} from '../lib/txdot_camera_inventory.mjs';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';

const now=Date.parse('2026-10-09T12:00:00Z');
const layer={editingInfo:{lastEditDate:Date.parse('2026-08-31T13:27:49Z')}};
const features=Array.from({length:25},(_,index)=>({attributes:{objectid:index+1,name:`I-30 camera ${index}`,highway:'IH 30',latitude:32.75,longitude:-97.09,ip:'192.0.2.5',device:'Internal model'},geometry:{x:-97.09,y:32.75}}));

test('TxDOT query requests only public display fields, never network or device fields',()=>{
  const url=new URL(txdotCameraQuery());
  assert.equal(url.searchParams.get('outFields'),'objectid,highway,name,latitude,longitude');
  assert.ok(!url.search.includes('ip'));
  assert.ok(!url.search.includes('device'));
});

test('TxDOT asset parser excludes source network fields and maps Arlington only',()=>{
  const result=parseTxdotCameraInventory(layer,{features},now);
  assert.equal(result.records.length,25);
  assert.equal(result.records[0].metadataDate,'2026-08-31');
  assert.ok(!JSON.stringify(result).includes('192.0.2.5'));
  assert.ok(!JSON.stringify(result).includes('Internal model'));
  assert.equal(result.records[0].viewerKind,'directory_only');
  const venues=[{id:'arlington',address:'Arlington, TX, USA',lat:32.74769,lon:-97.09288},{id:'houston',address:'Houston, TX, USA',lat:29.6847,lon:-95.4108}];
  const coverage=selectCameraCoverage(venues,result.records,[{id:'txdot-dfw-camera-assets',status:'ok'}]);
  assert.equal(coverage.arlington.length,5);
  assert.equal(coverage.houston,undefined);
});

test('old or incomplete TxDOT inventories fail closed',()=>{
  assert.throws(()=>parseTxdotCameraInventory({editingInfo:{lastEditDate:Date.parse('2026-01-01')}},{features},now),/older than 90 days/);
  assert.throws(()=>parseTxdotCameraInventory(layer,{features:features.slice(0,10)},now),/Incomplete/);
});
