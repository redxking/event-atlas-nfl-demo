import test from 'node:test';
import fs from 'node:fs';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';
import {sourceCoverageGap} from '../site/source_coverage.js';
import assert from 'node:assert/strict';
import {selectUsgsForGame} from '../site/usgs_nfl.js';

const now=Date.parse('2026-10-10T04:00:00Z');
const game={venue:{lat:34,lon:-118}};
const quake=(id,lat,lon,overrides={})=>({id,geometry:{type:'Point',coordinates:[lon,lat,6]},properties:{title:`M 3.0 synthetic ${id}`,mag:3,time:now-3600000,updated:now-1800000,url:`https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,...overrides}});
const conditions=features=>({at:now,quakes:{type:'FeatureCollection',metadata:{generated:now-60000},features}});

test('USGS selector retains only current linked nearby points and source dates',()=>{
  const result=selectUsgsForGame(game,conditions([quake('near',34.1,-118),quake('far',40,-118),quake('wrong',34.2,-118,{url:'https://example.org/quake'})]),now);
  assert.equal(result.state,'partial_source_data');
  assert.equal(result.invalidCount,1);
  assert.deepEqual(result.events.map(item=>item.sourceId),['near']);
  assert.equal(result.events[0].updatedAt,new Date(now-1800000).toISOString());
  assert.ok(result.events[0].distanceKm>0);
});

test('USGS failed or stale checks cannot become a negative finding',()=>{
  assert.equal(selectUsgsForGame(game,{...conditions([]),quakesError:'source failed'},now).state,'stale_or_unavailable');
  assert.equal(selectUsgsForGame(game,{...conditions([]),quakes:{...conditions([]).quakes,metadata:{generated:now-2*3600000}}},now).state,'stale_or_unavailable');
  assert.equal(selectUsgsForGame(game,conditions([]),now,'season_planning').state,'not_started');
  assert.equal(selectUsgsForGame(game,{...conditions([]),at:now-6*60000},now).state,'stale_or_unavailable');
});


test('malformed records cannot become a checked empty sample or throw on source timestamps',()=>{
 const result=selectUsgsForGame(game,conditions([null,quake('bad',34,-118,{updated:1e99}),quake('valid',34.1,-118)]),now);
 assert.equal(result.state,'partial_source_data');
 assert.equal(result.invalidCount,2);
 assert.deepEqual(result.events.map(item=>item.sourceId),['valid']);
 const empty=selectUsgsForGame(game,conditions([]),now);
 assert.equal(empty.state,'current_snapshot');
 assert.equal(empty.invalidCount,0);
 assert.equal(selectUsgsForGame(game,conditions([null]),now).state,'partial_source_data');
 assert.equal(selectUsgsForGame({venue:{lat:100,lon:-118}},conditions([]),now).state,'not_screenable');
});


test('all frozen U.S. game identities retain partial earthquake coverage as a gap',()=>{
 const scope=JSON.parse(fs.readFileSync('data/nfl_demo_window_scope.json'));
 const games=JSON.parse(fs.readFileSync('site/nfl.json')).games.filter(item=>scope.frozenGameIds.includes(item.id));
 assert.equal(games.length,27);
 for(const selected of games){
  const at=Date.parse(selected.kickoff)-3600000;
  const picture=buildNflEventPicture(selected,{conditions:{at,quakes:{type:'FeatureCollection',metadata:{generated:at},features:[null]}}},at);
  const source=picture.sources.find(item=>item.name==='USGS earthquakes');
  assert.equal(picture.eventId,selected.id);
  assert.equal(source.state,'partial_source_data');
  assert.equal(sourceCoverageGap(source),'Only partial source data is available');
  assert.equal(picture.usgsContext.events.length,0);
  assert.equal(picture.cues.length,0);
 }
});
