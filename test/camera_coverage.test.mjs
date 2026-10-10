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

test('TDOT Nashville camera inventory covers Nissan Stadium only when source succeeds',()=>{
  const venue={id:'3810',address:'Nashville, TN, USA',lat:36.1664,lon:-86.7714};
  const camera={id:'tdot-smartway-3219',agency:'TDOT SmartWay',lat:36.17,lon:-86.77};
  assert.deepEqual(selectCameraCoverage([venue],[camera],[{id:'tdot-smartway-cameras',status:'failed'}]),{});
  assert.equal(selectCameraCoverage([venue],[camera],[{id:'tdot-smartway-cameras',status:'ok'}])['3810'].length,1);
});

test('public video links stay on their agency HLS hosts and camera IDs',()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('../site/cameras.json',import.meta.url)));
  const items=snapshot.byVenue?.['3798']||[];
  assert.ok(items.some(item=>item.videoUrl),'expected a public WisDOT HLS link in the saved snapshot');
  for(const item of Object.values(snapshot.byVenue).flat().filter(item=>item.agency==='Caltrans'&&item.videoPlaylistStatus)){
    assert.equal(item.videoPlaylistStatus==='playlist_reachable_at_sync',!!item.videoUrl);
  }
  for(const item of Object.values(snapshot.byVenue).flat().filter(item=>item.videoUrl)){
    if(item.agency==='WisDOT 511'){
      assert.equal(item.operationalStatus,'Enabled');
      assert.match(item.videoUrl,/^https:\/\/cctv\d+\.dot\.wi\.gov\/rtplive\/CCTV-\d{2}-\d{4}\/playlist\.m3u8$/);
      assert.match(item.viewerUrl,/^https:\/\/511wi\.gov\/map\/Cctv\/\d+$/);
    }else if(item.agency==='MnDOT IRIS'){
      assert.equal(item.agency,'MnDOT IRIS');
      assert.match(item.id,/^mndot-C\d{1,6}$/);
      assert.equal(item.videoUrl,`https://video.dot.state.mn.us/public/${item.id.slice(6)}.stream/playlist.m3u8`);
    }else if(item.agency==='Caltrans'){
      assert.equal(item.inService,true);
      assert.match(item.id,/^caltrans-([47])-\d{1,6}$/);
      const district=item.id.split('-')[1];
      assert.match(item.videoUrl,new RegExp(`^https://wzmedia\\.dot\\.ca\\.gov/D${district}/[A-Za-z0-9_-]+\\.stream/playlist\\.m3u8$`));
    }else if(item.agency==='NJTA'){
      assert.equal(item.agency,'NJTA');
      assert.match(item.id,/^njta-\d{1,6}$/);
      assert.match(item.videoUrl,/^https:\/\/wink\.njta\.com\/\d{1,4}\/public\/hls\/[A-Za-z0-9-]+_nj\.m3u8$/);
      assert.equal(item.viewerUrl,'https://www.njta.gov/travel-resources/camera-list/');
    }else{
      assert.equal(item.agency,'TDOT SmartWay');
      assert.equal(item.inService,true);
      assert.match(item.id,/^tdot-smartway-\d{1,6}$/);
      assert.match(item.videoUrl,/^https:\/\/mcleansfs[1-9]\d*\.us-east-1\.skyvdn\.com\/rtplive\/R3_\d{3}\/playlist\.m3u8$/);
      assert.match(item.viewerUrl,/^https:\/\/smartway\.tn\.gov\/allcams\/camera\/\d{1,6}$/);
    }
  }
});
