import test from 'node:test';
import assert from 'node:assert/strict';
import {publicRoadVideoAgency} from '../site/camera_video.js';

test('only source-matched agency HLS URLs can be played',()=>{
  const ca={id:'caltrans-7-1183',agency:'Caltrans',inService:true,videoUrl:'https://wzmedia.dot.ca.gov/D7/CCTV-848.stream/playlist.m3u8'};
  assert.equal(publicRoadVideoAgency(ca),'Caltrans');
  assert.equal(publicRoadVideoAgency({...ca,id:'caltrans-4-1183'}),null);
  assert.equal(publicRoadVideoAgency({...ca,inService:false}),null);
  assert.equal(publicRoadVideoAgency({...ca,videoUrl:'https://wzmedia.dot.ca.gov/D7/../private.stream/playlist.m3u8'}),null);
  const mn={id:'mndot-C627',agency:'MnDOT IRIS',videoUrl:'https://video.dot.state.mn.us/public/C627.stream/playlist.m3u8'};
  assert.equal(publicRoadVideoAgency(mn),'MnDOT');
  assert.equal(publicRoadVideoAgency({...mn,id:'mndot-C628'}),null);
  assert.equal(publicRoadVideoAgency({...mn,videoUrl:'https://video.dot.state.mn.us/public/C627.stream/../../private.m3u8'}),null);
  assert.equal(publicRoadVideoAgency({...mn,agency:'Other'}),null);
  assert.equal(publicRoadVideoAgency({agency:'WisDOT 511',videoUrl:'https://cctv1.dot.wi.gov/rtplive/CCTV-01-0001/playlist.m3u8'}),'WisDOT');
  const nj={id:'njta-57',agency:'NJTA',videoUrl:'https://wink.njta.com/204/public/hls/WF05-24B0-46EE-1F2E-1932_nj.m3u8'};
  assert.equal(publicRoadVideoAgency(nj),'NJTA');
  assert.equal(publicRoadVideoAgency({...nj,videoUrl:'https://wink.njta.com/204/private/hls/WF05-24B0-46EE-1F2E-1932_nj.m3u8'}),null);
  const tn={id:'tdot-smartway-3219',agency:'TDOT SmartWay',inService:true,videoUrl:'https://mcleansfs1.us-east-1.skyvdn.com/rtplive/R3_006/playlist.m3u8'};
  assert.equal(publicRoadVideoAgency(tn),'TDOT SmartWay');
  assert.equal(publicRoadVideoAgency({...tn,inService:false}),null);
  assert.equal(publicRoadVideoAgency({...tn,videoUrl:'https://unapproved.example/R3_006/playlist.m3u8'}),null);
});
