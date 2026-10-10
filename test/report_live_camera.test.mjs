import test from 'node:test';
import assert from 'node:assert/strict';
import {selectReportRoadCamera} from '../site/report_live_camera.js';
import {renderPublicReportHtml} from '../scripts/render_public_report_html.mjs';

const now=Date.parse('2026-10-10T12:00:00Z');
const sourceUrl='https://www.tdot.tn.gov/opendata/api/public/RoadwayCameras';
const videoUrl='https://mcleansfs1.us-east-1.skyvdn.com/rtplive/R3_006/playlist.m3u8';
const camera={id:'tdot-smartway-3219',agency:'TDOT SmartWay',name:'I-24 public road view',distanceKm:0.6,inService:true,sourceUrl,viewerUrl:'https://smartway.tn.gov/allcams/camera/3219',stillUrl:'https://tnsnapshots.com/thumbs/R3_006.flv.png',videoUrl};
const snapshot={builtAt:'2026-10-10T11:30:00Z',sources:[{status:'ok',url:sourceUrl}],byVenue:{'3810':[camera]}};

test('published report selects a source-linked camera scoped to the requested venue',()=>{
  const selected=selectReportRoadCamera(snapshot,'3810',now);
  assert.equal(selected.state,'available');
  assert.equal(selected.item.videoUrl,videoUrl);
  assert.equal(selected.item.stillUrl,camera.stillUrl);
  assert.equal(selectReportRoadCamera(snapshot,'3628',now).state,'no_coverage');
  assert.equal(selectReportRoadCamera({...snapshot,builtAt:'2026-10-09T22:00:00Z'},'3810',now).state,'stale_or_unavailable');
});

test('camera playback rejects changed publisher URL, bad source state, and unavailable playlist',()=>{
  const changed={...camera,videoUrl:'https://other.example/playlist.m3u8',stillUrl:null};
  assert.equal(selectReportRoadCamera({...snapshot,byVenue:{'3810':[changed]}},'3810',now).state,'no_public_image');
  assert.equal(selectReportRoadCamera({...snapshot,sources:[{status:'failed',url:sourceUrl}]},'3810',now).state,'no_public_image');
  assert.equal(selectReportRoadCamera({...snapshot,byVenue:{'3810':[{...camera,videoPlaylistStatus:'playlist_unavailable_at_sync',stillUrl:null}]}},'3810',now).state,'no_public_image');
});

test('published event report includes the on-demand roadway camera panel',()=>{
  const html=renderPublicReportHtml('# Source review',{title:'Source review',generatedAt:'2026-10-10T12:00:00Z',markdownPath:'nfl-401872984.md',liveContext:{venueId:'3810',gameId:'nfl:401872984',kickoff:'2026-10-11T17:00:00Z'}});
  assert.match(html,/report_live_camera\.js/);
  assert.match(html,/id="direct-road-camera"/);
  assert.match(html,/Nearby public roadway camera/);
});
