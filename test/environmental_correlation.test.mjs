import test from 'node:test';
import assert from 'node:assert/strict';
import {correlateEnvironmentalSources} from '../site/environmental_correlation.js';

const smoke={state:'recent_daily_analysis',sourceUrl:'https://satepsanone.nesdis.noaa.gov/example.kml',polygons:[{startAt:'2026-10-09T17:00:00Z',endAt:'2026-10-09T20:00:00Z'}]};
const wildfire={state:'current_snapshot',sourceUrl:'https://data-nifc.opendata.arcgis.com/',events:[{id:1}]};
const air=observedAt=>({state:'current_station_observation',sourceUrl:'https://ofmpub.epa.gov/rsig/rsigserver?source=example',observation:{stationId:'123',distanceKm:6,pm25UgM3:8.2,observedAt}});

test('published smoke and station times are compared without inferring exposure',()=>{
  const result=correlateEnvironmentalSources(smoke,air('2026-10-09T18:00:00Z'),wildfire);
  assert.equal(result.state,'same_published_time_window');
  assert.equal(result.nearbyWildfirePointCount,1);
  assert.match(result.interpretation,/No exposure/);
});

test('a later station reading cannot corroborate an earlier smoke polygon window',()=>{
  const result=correlateEnvironmentalSources(smoke,air('2026-10-10T03:00:00Z'),wildfire);
  assert.equal(result.state,'station_observation_after_polygon_windows');
  assert.match(result.summary,/cannot confirm conditions during those earlier windows/);
});

test('failed source and no polygon match remain explicit gaps',()=>{
  assert.equal(correlateEnvironmentalSources({state:'stale_or_unavailable',polygons:[]},air('2026-10-10T03:00:00Z'),wildfire).state,'not_evaluable');
  const empty=correlateEnvironmentalSources({...smoke,polygons:[]},air('2026-10-10T03:00:00Z'),wildfire);
  assert.equal(empty.state,'no_polygon_point_match');
  assert.match(empty.summary,/not an all-clear/);
});
