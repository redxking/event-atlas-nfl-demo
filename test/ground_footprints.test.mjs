import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pointInsideRing} from '../site/ground_relevance.js';

test('mapped NFL ground candidates keep source identity and expose the SoFi point conflict',()=>{
  const feed=JSON.parse(fs.readFileSync('site/ground_footprints.json','utf8'));
  const schedule=JSON.parse(fs.readFileSync('site/nfl.json','utf8'));
  const venues=new Map(schedule.games.map(game=>[game.venue.id,game.venue]));
  assert.equal(feed.venueCount,venues.size);
  assert.equal(feed.matched,Object.keys(feed.byVenue).length);
  assert.equal(feed.matched+Object.keys(feed.unmatched).length,venues.size);
  assert.ok(feed.matched>=24);
  assert.match(feed.licenseUrl,/openstreetmap\.org\/copyright/);
  for(const [id,item] of Object.entries(feed.byVenue)){
    const venue=venues.get(id);
    assert.ok(venue);
    assert.equal(item.wikidata,venue.venueCandidateUrl.split('/').at(-1));
    assert.equal(item.status,'unreviewed_osm_footprint_candidate');
    assert.match(item.sourceUrl,new RegExp(`openstreetmap\\.org/way/${item.osmId}$`));
    assert.ok(item.sourceVersion>0&&Date.parse(item.sourceEditedAt)>0);
    assert.ok(item.areaM2>=1000&&item.areaM2<=1000000);
    assert.ok(item.ring.length>=4);
    assert.deepEqual(item.ring[0],item.ring.at(-1));
    assert.ok(item.ring.every(([lon,lat])=>Number.isFinite(lon)&&Number.isFinite(lat)));
  }
  assert.equal(pointInsideRing(venues.get('7065'),feed.byVenue['7065'].ring),false);
  assert.equal(pointInsideRing(venues.get('3687'),feed.byVenue['3687'].ring),true);
});
