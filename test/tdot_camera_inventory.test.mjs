import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTdotCameraInventory,tdotCameraRequestConfig,TDOT_CAMERA_API} from '../lib/tdot_camera_inventory.mjs';

const item=id=>({id,name:`R3_${String(id).padStart(3,'0')}`,description:'I-24 near Nashville',jurisdiction:'Nashville',active:'true',lat:36.166, lng:-86.772,route:'I-24',thumbnailUrl:`https://tnsnapshots.com/thumbs/R3_${String(id).padStart(3,'0')}.flv.png`,httpsVideoUrl:`https://mcleansfs1.us-east-1.skyvdn.com/rtplive/R3_${String(id).padStart(3,'0')}/playlist.m3u8`});

test('TDOT public config is accepted only for the published camera endpoint',()=>{
  const config={apiBaseUrl:'https://www.tdot.tn.gov/opendata/api/public/',cameras:'RoadwayCameras',apiKey:'a'.repeat(32)};
  assert.equal(tdotCameraRequestConfig(config).url,TDOT_CAMERA_API);
  assert.throws(()=>tdotCameraRequestConfig({...config,apiBaseUrl:'https://other.example/'}),/changed/);
  assert.throws(()=>tdotCameraRequestConfig({...config,apiKey:'bad'}),/changed/);
});

test('TDOT inventory keeps bounded active Nashville roadway cameras and approved HLS',()=>{
  const raw=Array.from({length:120},(_,index)=>item(index+1));
  raw[0].httpsVideoUrl='https://unapproved.example/private.m3u8';
  raw[1].active='false';
  raw[2].jurisdiction='Memphis';
  const result=parseTdotCameraInventory(raw);
  assert.equal(result.length,118);
  assert.equal(result[0].videoUrl,undefined);
  assert.equal(result[0].viewerUrl,'https://smartway.tn.gov/allcams/camera/1');
  assert.equal(result[1].id,'tdot-smartway-4');
  assert.match(result[1].videoUrl,/^https:\/\/mcleansfs1\.us-east-1\.skyvdn\.com/);
  assert.ok(!JSON.stringify(result).includes('ApiKey'));
  assert.throws(()=>parseTdotCameraInventory(raw.slice(0,10)),/Incomplete/);
});
