import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectEonetForGame,eonetSourceUrl} from '../site/eonet_nfl.js';
import {selectNifcForGame,nifcSource} from '../site/nifc_wildfire.js';
import {selectAirnowForGame,airnowQueryUrl} from '../site/airnow_pm25.js';
import {selectHmsSmokeForGame} from '../site/hms_smoke.js';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';
import {attentionSummary} from '../site/attention_summary.js';
import {buildScopeThreatReport} from '../site/scope_threat_report.js';
import {sourceCoverageGap} from '../site/source_coverage.js';
const now=Date.parse('2026-10-10T12:00:00Z'),iso=new Date(now).toISOString();
const smokeUrl='https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML/2026/10/hms_smoke20261010.kml';
const specs=[
 {key:'eonet',select:selectEonetForGame,emptyState:'current_snapshot',field:'events',data:{schema:'event-atlas.eonet-nfl.v1',status:'ok',builtAt:iso,sourceUrl:eonetSourceUrl,byVenue:{}}},
 {key:'nifc',select:selectNifcForGame,emptyState:'current_snapshot',field:'events',data:{schema:'event-atlas.nifc-wildfire.v1',status:'ok',builtAt:iso,sourceUrl:nifcSource,byVenue:{}}},
 {key:'airnow',select:selectAirnowForGame,emptyState:'no_current_nearby_station',field:'observation',data:{schema:'event-atlas.airnow-pm25.v1',status:'ok',builtAt:iso,sourceUrl:airnowQueryUrl(now),byVenue:{}}},
 {key:'hmsSmoke',select:selectHmsSmokeForGame,emptyState:'recent_daily_analysis',field:'polygons',data:{schema:'event-atlas.hms-smoke.v1',status:'ok',builtAt:iso,sourceUrl:smokeUrl,latestPolygonEndAt:iso,byVenue:{}}}
];
const game={id:'nfl:fixture',kickoff:'2026-10-11T17:00:00Z',venue:{id:'fixture',lat:34,lon:-118}};
test('checked empty environmental data stays distinct from missing or malformed venue records',()=>{
 for(const spec of specs){
  const empty=spec.select(game,spec.data,now);assert.equal(empty.state,spec.emptyState,spec.key);
  for(const map of [undefined,null,[],{fixture:null},{fixture:'invalid'},{fixture:{malformed:true}}]){
   const selected=spec.select(game,{...spec.data,byVenue:map},now);
   assert.equal(selected.state,'stale_or_unavailable',spec.key);assert.deepEqual(selected[spec.field],spec.field==='observation'?null:[]);
  }
  for(const data of [{...spec.data,status:'failed'},{...spec.data,builtAt:new Date(now-13*3600000).toISOString()},{...spec.data,builtAt:new Date(now+120000).toISOString()}])assert.equal(spec.select(game,data,now).state,'stale_or_unavailable');
 }
 assert.ok(sourceCoverageGap({state:'no_current_nearby_station'}));
});
test('invalid selected points and impossible smoke windows cannot masquerade as empty current results',()=>{
 const records={
  eonet:[{sourceUrl:'https://example.invalid/event',distanceKm:1,sourceAt:iso}],
  nifc:[{id:1,sourceUrl:'https://example.invalid/fire',distanceKm:-1,updatedAt:iso}],
  airnow:{stationId:'123',sourceUrl:specs[2].data.sourceUrl,distanceKm:-1,pm25UgM3:10,observedAt:iso},
  hmsSmoke:[{polygonIndex:1,density:'light',sourceUrl:smokeUrl,startAt:new Date(now+3600000).toISOString(),endAt:iso}]
 };
 for(const spec of specs)assert.equal(spec.select(game,{...spec.data,byVenue:{fixture:records[spec.key]}},now).state,'stale_or_unavailable',spec.key);
});
test('all 27 game reports retain malformed environmental sources as gaps without current findings',()=>{
 const scope=JSON.parse(fs.readFileSync('data/nfl_demo_window_scope.json'));
 const games=JSON.parse(fs.readFileSync('site/nfl.json')).games.filter(g=>scope.frozenGameIds.includes(g.id));assert.equal(games.length,27);
 for(const game of games){
  const inputs=Object.fromEntries(specs.map(s=>[s.key,{...s.data,byVenue:{[game.venue.id]:{invalid:true}}}]));
  const picture=buildNflEventPicture(game,inputs,now);const summary=attentionSummary(picture);
  const report=buildScopeThreatReport({title:game.title,level:'event',games:[game],summaries:new Map([[game.id,summary]])});
  assert.equal(report.findings.length,0);assert.equal(picture.environmentalCorrelation.state,'not_evaluable');
  for(const name of ['NASA EONET natural events','NIFC current wildfire points','EPA AirNow nearby PM2.5','NOAA HMS smoke polygons'])assert.ok(report.coverageGaps.some(g=>g.source?.name===name),game.id+' '+name);
 }
});
