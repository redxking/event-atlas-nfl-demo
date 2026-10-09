import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';
import fs from 'node:fs';

test('failed camera source leaves venue uncovered instead of reporting an empty inventory',()=>{
  const venue={id:'pittsburgh',address:'Pittsburgh, PA, USA',lat:40.4467,lon:-80.0158};
  const cameras=[{id:'camera-1',agency:'PennDOT GIS',lat:40.447,lon:-80.016}];
  assert.deepEqual(selectCameraCoverage([venue],cameras,[{id:'penndot-camera-inventory',status:'failed'}]),{});
  assert.equal(selectCameraCoverage([venue],cameras,[{id:'penndot-camera-inventory',status:'ok'}]).pittsburgh.length,1);
});

test('Maryland iMAP inventory can cover a venue when the CHART endpoint fails',()=>{
  const venue={id:'baltimore',address:'Baltimore, MD, USA',lat:39.278,lon:-76.622};
  const cameras=[{id:'md-imap-42',agency:'Maryland CHART',lat:39.28,lon:-76.62}];
  const sources=[{id:'md-chart-cameras',status:'failed'},{id:'md-imap-cameras',status:'ok'}];
  assert.equal(selectCameraCoverage([venue],cameras,sources).baltimore.length,1);
});

test('MnDOT published inventory links U.S. Bank Stadium only when the source succeeds',()=>{
  const venue={id:'5239',address:'Minneapolis, MN, USA',lat:44.973889,lon:-93.258056};
  const cameras=[{id:'mndot-C627',agency:'MnDOT IRIS',lat:44.9717,lon:-93.2522,viewerUrl:'https://511mn.org/cameras'}];
  assert.deepEqual(selectCameraCoverage([venue],cameras,[{id:'mndot-iris-cameras',status:'failed'}]),{});
  assert.equal(selectCameraCoverage([venue],cameras,[{id:'mndot-iris-cameras',status:'ok'}])['5239'].length,1);
});

test('Georgia DOT metadata covers the Atlanta venue only when the agency source succeeds',()=>{
  const venue={id:'atlanta',address:'Atlanta, GA, USA',lat:33.7553,lon:-84.4008};
  const cameras=[{id:'gdot-1',agency:'Georgia DOT GIS',lat:33.76,lon:-84.4}];
  assert.deepEqual(selectCameraCoverage([venue],cameras,[{id:'gdot-atlanta-cameras',status:'failed'}]),{});
  assert.equal(selectCameraCoverage([venue],cameras,[{id:'gdot-atlanta-cameras',status:'ok'}]).atlanta.length,1);
});

test('WisDOT public video links stay on the agency HLS host and are tied to Green Bay roadway cameras',()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('../site/cameras.json',import.meta.url)));
  const items=snapshot.byVenue?.['3798']||[];
  assert.ok(items.some(item=>item.videoUrl),'expected a public WisDOT HLS link in the saved snapshot');
  for(const item of Object.values(snapshot.byVenue).flat().filter(item=>item.videoUrl)){
    assert.equal(item.agency,'WisDOT 511');
    assert.equal(item.operationalStatus,'Enabled');
    assert.match(item.videoUrl,/^https:\/\/cctv\d+\.dot\.wi\.gov\/rtplive\/CCTV-\d{2}-\d{4}\/playlist\.m3u8$/);
    assert.match(item.viewerUrl,/^https:\/\/511wi\.gov\/map\/Cctv\/\d+$/);
  }
});
