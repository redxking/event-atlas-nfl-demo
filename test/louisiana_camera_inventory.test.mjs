import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLouisianaCameras,parseLouisianaPublicCameraList,louisianaPublicListUrl} from '../lib/louisiana_camera_inventory.mjs';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';
import {publicRoadVideoAgency} from '../site/camera_video.js';

test('511LA camera views remain agency linked and reject nonpublic video hosts',()=>{
  const sample=Array.from({length:101},(_,index)=>({Id:index+1,Latitude:29.95,Longitude:-90.08,Location:`I-10 camera ${index+1}`,Roadway:'I-10',Views:[{Id:index+2001,Status:'Enabled',VideoUrl:index===0?'https://ITSStreamingNO.dotd.la.gov/public/no-cam-001.streams/playlist.m3u8':'https://example.com/private/playlist.m3u8'}]}));
  const items=parseLouisianaCameras(sample);
  assert.equal(items.length,101);
  assert.equal(items[0].viewerUrl,'https://511la.org/map/Cctv/2001');
  assert.equal(publicRoadVideoAgency(items[0]),'Louisiana 511');
  assert.equal(items[1].videoUrl,undefined);
  assert.equal(publicRoadVideoAgency({...items[0],videoUrl:'https://ITSStreamingNO.dotd.la.gov/public/../private/playlist.m3u8'}),null);
  const venue={id:'3493',address:'New Orleans, LA, USA',lat:29.9509,lon:-90.0812};
  assert.deepEqual(selectCameraCoverage([venue],items,[{id:'la511-public-cameras',status:'not_configured'}]),{});
  assert.equal(selectCameraCoverage([venue],items,[{id:'la511-public-cameras',status:'ok'}])['3493'].length,5);
});

test('partial 511LA inventory cannot imply no nearby camera',()=>{
  assert.throws(()=>parseLouisianaCameras([]),/Incomplete/);
});

test('public 511LA directory pages yield venue-linked public views without a developer key',()=>{
  const rows=Array.from({length:101},(_,index)=>({id:index+1,location:`Road ${index}`,roadway:'I-10',latLng:{geography:{wellKnownText:'POINT (-90.08 29.95)'}},images:[{id:index+201,videoUrl:index===0?'https://ITSStreamingNO.dotd.la.gov/public/nor-cam-140.streams/playlist.m3u8':'https://example.com/private.m3u8',disabled:false,blocked:false,videoDisabled:false,isVideoAuthRequired:false}]}));
  const pages=[{recordsTotal:101,data:rows.slice(0,100)},{recordsTotal:101,data:rows.slice(100)}];
  assert.equal(louisianaPublicListUrl(100).origin,'https://511la.org');
  const items=parseLouisianaPublicCameraList(pages);
  assert.equal(items.length,101);
  assert.equal(items[0].viewerUrl,'https://511la.org/map/Cctv/201');
  assert.equal(publicRoadVideoAgency(items[0]),'Louisiana 511');
  assert.equal(items[1].videoUrl,undefined);
  assert.throws(()=>parseLouisianaPublicCameraList(pages.slice(0,1)),/Incomplete/);
});
