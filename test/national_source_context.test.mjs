import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectNtas,selectSpaceWeather,ntasSourceUrl,spaceWeatherSourceUrl} from '../site/national_source_context.js';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';
const now=Date.parse('2026-10-10T18:00:00Z');
const at=new Date(now).toISOString();
const weather=()=>({status:'ok',sourceUrl:spaceWeatherSourceUrl,retrievedAt:at,observed:{at,scales:{G:2,R:0,S:1}},outlook:[{at,scales:{G:3,R:null,S:null}}]});
const advisory=()=>({type:'Test advisory',start:new Date(now-3600000).toISOString(),end:new Date(now+3600000).toISOString(),url:'https://www.dhs.gov/test-advisory',summary:'Controlled fixture',locations:['United States'],sectors:['Transportation']});
const ntas=()=>({status:'ok',sourceUrl:ntasSourceUrl,retrievedAt:at,active:[advisory()],activeCount:1});
test('national source context retains observed scales and bounded advisories without a venue attribution',()=>{
 assert.equal(selectSpaceWeather(weather(),now).observed.scales.G,2);
 assert.equal(selectSpaceWeather(weather(),now).outlook[0].scales.R,null);
 assert.equal(selectNtas(ntas(),now).activeCount,1);
 assert.equal(selectNtas({...ntas(),active:[],activeCount:0},now).state,'current national snapshot');
 assert.equal(selectNtas(ntas(),now+3600000).activeCount,0);
});
test('malformed national source values stay unavailable rather than a current empty result',()=>{
 for(const snapshot of [null,{...weather(),sourceUrl:'https://example.org'}, {...weather(),observed:{at,scales:{G:99,R:0,S:0}}},{...weather(),outlook:{}},{...weather(),status:'unavailable'},{...weather(),retrievedAt:new Date(now+120000).toISOString()}])assert.equal(selectSpaceWeather(snapshot,now).state,'stale or unavailable');
 for(const snapshot of [null,{...ntas(),activeCount:0},{...ntas(),active:[{...advisory(),url:'https://example.org'}]},{...ntas(),active:[{...advisory(),end:new Date(now-1).toISOString()}]},{...ntas(),active:[{...advisory(),locations:{}}]},{...ntas(),status:'failed'}])assert.equal(selectNtas(snapshot,now).state,'stale or unavailable');
});
test('all frozen U.S. game pictures preserve invalid national feed gaps without threat cues',()=>{
 const games=JSON.parse(fs.readFileSync(new URL('../site/nfl.json',import.meta.url))).games;
 const scope=JSON.parse(fs.readFileSync(new URL('../data/nfl_demo_window_scope.json',import.meta.url)));
 const selected=games.filter(game=>scope.frozenGameIds.includes(game.id));
 assert.equal(selected.length,27);
 for(const game of selected){
  const picture=buildNflEventPicture(game,{spaceWeather:{...weather(),observed:{at,scales:{G:999,R:0,S:0}}},ntas:{...ntas(),active:[{}]}},now);
  assert.equal(picture.eventId,game.id);
  for(const name of ['NOAA space weather','DHS NTAS'])assert.equal(picture.sources.find(source=>source.name===name).state,'stale or unavailable');
  assert.equal(picture.ntasContext.active,undefined);
  assert.equal(picture.cues.length,0);
 }
});
