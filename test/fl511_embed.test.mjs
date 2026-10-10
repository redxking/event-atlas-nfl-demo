import test from 'node:test';
import assert from 'node:assert/strict';
import {fl511EmbedUrl} from '../site/fl511_embed.js';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';

const dolphins={id:'nfl:demo',kickoff:'2026-10-11T17:00:00Z',venue:{id:'3948',name:'Hard Rock Stadium',lat:25.958055555,lon:-80.238888888}};
const floridaVenues=[dolphins.venue,{id:'3712',name:'EverBank Stadium',lat:30.323889,lon:-81.6375},{id:'3886',name:'Raymond James Stadium',lat:27.975833333,lon:-82.503333333}];

test('Florida 511 publisher map centers on each known Florida NFL venue candidate point',()=>{
  for(const venue of floridaVenues){
    const url=new URL(fl511EmbedUrl({...dolphins,venue}));
    assert.equal(url.origin,'https://fl511.com');
    assert.equal(url.pathname,'/Map/EmbeddedMap');
    assert.equal(url.searchParams.get('layers'),'Closures,Incidents,Cameras');
    assert.equal(url.searchParams.get('lat'),String(venue.lat));
    assert.equal(url.searchParams.get('lng'),String(venue.lon));
  }
  assert.equal(fl511EmbedUrl({...dolphins,venue:{...dolphins.venue,id:'3493'}}),null);
  assert.equal(fl511EmbedUrl({...dolphins,venue:{...dolphins.venue,lat:0}}),null);
});

test('publisher map is labeled as an embed, not an ingested feed',()=>{
  for(const venue of floridaVenues){
    const picture=buildNflEventPicture({...dolphins,venue},{schedule:{builtAt:'2026-10-10T09:00:00Z'}},Date.parse('2026-10-10T09:05:00Z'));
    const source=picture.sources.find(item=>item.name==='Florida 511 publisher map');
    assert.equal(source.state,'publisher_embed_only');
    assert.match(source.detail,/does not ingest Florida 511 records/);
    assert.equal(source.sourceUrl,'https://fl511.com/Map/EmbeddedMapSetup');
  }
});
