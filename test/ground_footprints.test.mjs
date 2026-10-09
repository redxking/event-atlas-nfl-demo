import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pointInsideRing} from '../site/ground_relevance.js';

test('mapped NFL ground candidates keep source identity and mark the corrected SoFi candidate point',()=>{
  const feed=JSON.parse(fs.readFileSync('site/ground_footprints.json','utf8'));
  const schedule=JSON.parse(fs.readFileSync('site/nfl.json','utf8'));
  const venues=new Map(schedule.games.map(game=>[game.venue.id,game.venue]));
  assert.equal(feed.venueCount,venues.size);
  assert.equal(feed.matched,Object.keys(feed.byVenue).length);
  assert.equal(feed.matched+Object.keys(feed.unmatched).length,venues.size);
  assert.equal(feed.matched,30);
  assert.match(feed.licenseUrl,/openstreetmap\.org\/copyright/);
  for(const [id,item] of Object.entries(feed.byVenue)){
    const venue=venues.get(id);
    assert.ok(venue);
    assert.equal(item.matchedCandidateWikidata,venue.venueCandidateUrl.split('/').at(-1));
    if(item.identityMethod==='wikidata')assert.equal(item.wikidata,item.matchedCandidateWikidata);
    else {assert.equal(item.identityMethod,'exact_name');assert.equal(item.wikidata,null)}
    assert.equal(item.status,'unreviewed_osm_footprint_candidate');
    assert.match(item.sourceUrl,new RegExp(`openstreetmap\\.org/${item.osmType}/${item.osmId}$`));
    assert.ok(item.sourceVersion>0&&Date.parse(item.sourceEditedAt)>0);
    assert.ok(item.areaM2>=1000&&item.areaM2<=1000000);
    for(const ring of item.outerRings||[item.ring]){
      assert.ok(ring.length>=4);
      assert.deepEqual(ring[0],ring.at(-1));
      assert.ok(ring.every(([lon,lat])=>Number.isFinite(lon)&&Number.isFinite(lat)));
    }
  }
  assert.equal(feed.byVenue['3970'].outerRings.length,2);
  assert.ok(feed.byVenue['3970'].outerRings.some(ring=>pointInsideRing(venues.get('3970'),ring)));
  assert.equal(pointInsideRing(venues.get('7065'),feed.byVenue['7065'].ring),true);
  assert.match(venues.get('7065').coordinateStatus,/OpenStreetMap way 860635712.*Wikidata point conflict; unreviewed/);
  assert.equal(pointInsideRing(venues.get('3687'),feed.byVenue['3687'].ring),true);
});
