import test from 'node:test';
import assert from 'node:assert/strict';
import {selectUsgsForGame} from '../site/usgs_nfl.js';

const now=Date.parse('2026-10-10T04:00:00Z');
const game={venue:{lat:34,lon:-118}};
const quake=(id,lat,lon,overrides={})=>({id,geometry:{type:'Point',coordinates:[lon,lat,6]},properties:{title:`M 3.0 synthetic ${id}`,mag:3,time:now-3600000,updated:now-1800000,url:`https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,...overrides}});
const conditions=features=>({at:now,quakes:{type:'FeatureCollection',metadata:{generated:now-60000},features}});

test('USGS selector retains only current linked nearby points and source dates',()=>{
  const result=selectUsgsForGame(game,conditions([quake('near',34.1,-118),quake('far',40,-118),quake('wrong',34.2,-118,{url:'https://example.org/quake'})]),now);
  assert.equal(result.state,'current_snapshot');
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
