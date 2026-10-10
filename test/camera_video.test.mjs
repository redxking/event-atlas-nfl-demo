import test from 'node:test';
import assert from 'node:assert/strict';
import {publicRoadVideoAgency} from '../site/camera_video.js';

test('only source-matched agency HLS URLs can be played',()=>{
  const mn={id:'mndot-C627',agency:'MnDOT IRIS',videoUrl:'https://video.dot.state.mn.us/public/C627.stream/playlist.m3u8'};
  assert.equal(publicRoadVideoAgency(mn),'MnDOT');
  assert.equal(publicRoadVideoAgency({...mn,id:'mndot-C628'}),null);
  assert.equal(publicRoadVideoAgency({...mn,videoUrl:'https://video.dot.state.mn.us/public/C627.stream/../../private.m3u8'}),null);
  assert.equal(publicRoadVideoAgency({...mn,agency:'Other'}),null);
  assert.equal(publicRoadVideoAgency({agency:'WisDOT 511',videoUrl:'https://cctv1.dot.wi.gov/rtplive/CCTV-01-0001/playlist.m3u8'}),'WisDOT');
});
