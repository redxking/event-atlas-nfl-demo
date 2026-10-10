import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchWpcRain,selectWpcRainForGame,WPC_RAIN_BASE} from '../site/wpc_rain_outlook.js';

const now=Date.parse('2026-10-09T21:00:00Z');
const venue={id:'v1',lat:1,lon:1};
const game={id:'g1',venue,kickoff:'2026-10-11T17:00:00Z',status:'scheduled',timeTbd:false};
const item={day:3,category:'Slight',categoryRank:2,validAt:'2026-10-11T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z',issuedAt:'2026-10-09T20:05:00Z',sourceUrl:`${WPC_RAIN_BASE}/2`};
const snapshot={status:'ok',builtAt:'2026-10-09T21:00:00Z',sources:[{day:3,validAt:item.validAt,expiresAt:item.expiresAt}],byVenue:{v1:[item]}};

test('WPC rainfall polygons respect holes and UTC issue and validity fields',()=>{
  const feature={properties:{dn:2,issue_time:'2026-10-09 20:05:00',start_time:'2026-10-11 12:00:00',end_time:'2026-10-12 12:00:00'},geometry:{type:'Polygon',coordinates:[[[0,0],[3,0],[3,3],[0,3],[0,0]],[[.2,.2],[.4,.2],[.4,.4],[.2,.4],[.2,.2]]]}};
  const result=matchWpcRain([feature],[venue,{id:'hole',lat:.3,lon:.3}],3,item.sourceUrl);
  assert.equal(result.v1[0].category,'Slight');
  assert.equal(result.hole,undefined);
  assert.deepEqual(matchWpcRain([{...feature,properties:{...feature.properties,start_time:'2026-99-11 12:00:00'}}],[venue],3,item.sourceUrl),{});
});

test('only a fresh published WPC outlook covering a future listed kickoff is selected',()=>{
  assert.equal(selectWpcRainForGame(game,snapshot,now).match.category,'Slight');
  assert.equal(selectWpcRainForGame({...game,kickoff:'2026-10-20T17:00:00Z'},snapshot,now).state,'outside published Day 1–3 window');
  assert.equal(selectWpcRainForGame({...game,timeTbd:true},snapshot,now).state,'not screenable');
  assert.equal(selectWpcRainForGame(game,{...snapshot,builtAt:'2026-10-08T00:00:00Z'},now).state,'stale or unavailable');
});

test('committed WPC snapshot has bounded source-linked venue matches',()=>{
  const saved=JSON.parse(fs.readFileSync(new URL('../site/wpc_rain_outlooks.json',import.meta.url)));
  assert.equal(saved.status,'ok');
  assert.deepEqual(saved.sources.map(source=>source.day),[1,2,3]);
  for(const items of Object.values(saved.byVenue))for(const match of items){
    assert.ok(/^https:\/\/mapservices\.weather\.noaa\.gov\//.test(match.sourceUrl));
    assert.ok(['Marginal','Slight','Moderate','High'].includes(match.category));
    assert.ok(Date.parse(match.validAt)<Date.parse(match.expiresAt));
  }
});
