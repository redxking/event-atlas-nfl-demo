import test from 'node:test';
import assert from 'node:assert/strict';
import {selectHmsSmokeForGame} from '../site/hms_smoke.js';

const now=Date.parse('2026-10-10T02:00:00Z');
const url='https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML/2026/10/hms_smoke20261009.kml';
const game={venue:{id:'x'}};
const polygon={polygonIndex:3,density:'light',startAt:'2026-10-09T16:00:00Z',endAt:'2026-10-09T20:00:00Z',sourceUrl:url};
const snapshot={schema:'event-atlas.hms-smoke.v1',status:'ok',builtAt:'2026-10-10T01:00:00Z',analysisDate:'2026-10-09',latestPolygonEndAt:'2026-10-09T23:00:00Z',sourceUrl:url,byVenue:{x:[polygon]}};
test('NOAA daily polygon selector retains a dated point match only in near-term mode',()=>{
  const selected=selectHmsSmokeForGame(game,snapshot,now);
  assert.equal(selected.state,'recent_daily_analysis');
  assert.deepEqual(selected.polygons,[polygon]);
  assert.equal(selectHmsSmokeForGame(game,snapshot,now,'season_planning').state,'not_started');
});
test('NOAA failed, stale, and unsupported polygon links do not establish a point match',()=>{
  assert.equal(selectHmsSmokeForGame(game,{...snapshot,status:'failed'},now).state,'stale_or_unavailable');
  assert.equal(selectHmsSmokeForGame(game,snapshot,now+37*3600000).state,'stale_or_unavailable');
  assert.deepEqual(selectHmsSmokeForGame(game,{...snapshot,byVenue:{x:[{...polygon,sourceUrl:'https://other.example/smoke.kml'}]}},now).polygons,[]);
});
