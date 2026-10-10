import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
import {makeMonitoringArea,withSpatialContext,distanceMeters} from '../site/window_spatial_engine.js';
import {applyExerciseReviews,recordExerciseReview} from '../site/window_review_engine.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
const venues=JSON.parse(fs.readFileSync(new URL('../site/window_venues.json',import.meta.url))).venues;
for(const game of games)test(`${game.id}: editable area updates spatial context and review`,()=>{
 const venue=venues.find(v=>v.id===game.venue.id);assert(venue);assert.match(venue.sourceUrl,/^https:\/\/www.wikidata.org\//);
 const raw=replayGameFeed(createGameFeed(game)),area=makeMonitoringArea(venue),base=withSpatialContext(raw,venue,area);
 assert(base.spatialContext.inside>0);assert(base.spatialContext.outside>0);
 const larger=makeMonitoringArea(venue,{radiusM:3000},area),expanded=withSpatialContext(raw,venue,larger);
 assert(expanded.spatialContext.inside>base.spatialContext.inside);assert.equal(larger.revision,2);
 const history=recordExerciseReview(base,base.candidates[0].id,'needs_verification');
 assert.equal(applyExerciseReviews(expanded,history).candidates[0].review.status,'evidence_changed_review_required');
 assert.equal(JSON.parse(JSON.stringify(expanded)).monitoringArea.radiusM,3000);
 assert(expanded.spatialContext.features.every(f=>f.evidenceId.startsWith(game.id)&&f.dataMode==='synthetic_exercise'));
});
test('invalid radius, coordinates and cross-venue context rejected',()=>{
 const venue=venues[0];for(const change of [{radiusM:0},{radiusM:3001},{lat:NaN},{lat:90},{lon:180}])assert.throws(()=>makeMonitoringArea(venue,change));
 const g=games[0],v=venues.find(v=>v.id===g.venue.id),brief=replayGameFeed(createGameFeed(g));
 assert.throws(()=>withSpatialContext(brief,v,{...makeMonitoringArea(v),venueId:'wrong'}));
 assert.equal(distanceMeters(v,v),0);
});
