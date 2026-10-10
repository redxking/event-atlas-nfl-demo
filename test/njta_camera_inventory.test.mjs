import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNjtaCameraInventory} from '../lib/njta_camera_inventory.mjs';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';

const entry=(id,lat,lon,video_url)=>({id,lat,lng:lon,mile_marker:112.3,relative_direction:'north',relative_text:'NJ 3 (East Rutherford)',video_url});
const url='https://wink.njta.com/204/public/hls/WF05-24B0-46EE-1F2E-1932_nj.m3u8';
const fixture=()=>{
  const turnpike=[entry(57,40.79667,-74.07989,url),...Array.from({length:59},(_,i)=>entry(i+100,39.5,-74.5,url))];
  const parkway=Array.from({length:50},(_,i)=>entry(i+1000,39.6,-74.6,url));
  const config=JSON.stringify({mode:'traffic-cameras',initialData:{cameras:{turnpike,parkway}}}).replaceAll('&','&amp;').replaceAll('"','&quot;');
  return `<div data-block-config="${config}"></div>`;
};
test('NJTA public camera catalog connects a nearby roadway HLS record to MetLife only',()=>{
  const records=parseNjtaCameraInventory(fixture());
  assert.equal(records.length,110);
  assert.equal(records[0].agency,'NJTA');
  assert.equal(records[0].videoUrl,url);
  const byVenue=selectCameraCoverage([{id:'3839',lat:40.81361,lon:-74.07444,address:'East Rutherford, NJ, USA'}],records,[{id:'njta-public-road-cameras',status:'ok'}]);
  assert.equal(byVenue['3839'].length,1);
  assert.equal(byVenue['3839'][0].id,'njta-57');
});
test('NJTA catalog rejects missing source configuration',()=>{
  assert.throws(()=>parseNjtaCameraInventory('<html></html>'),/unavailable/);
});
