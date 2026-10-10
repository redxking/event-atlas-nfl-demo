import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchSpcOutlook,selectSpcForGame,SPC_BASE} from '../site/spc_outlook.js';

const square=(a,b,c,d)=>[[[a,b],[c,b],[c,d],[a,d],[a,b]]];
const venue={id:'v1',lat:36,lon:-80};
const feature=(dn,geometry)=>({properties:{dn,valid:'202610111200',expire:'202610121200',issue:'202610091930'},geometry});

test('SPC categorical polygon matching excludes holes and malformed windows',()=>{
  const geometry={type:'MultiPolygon',coordinates:[[...square(-82,34,-78,38),...square(-80.5,35.5,-79.5,36.5)]]};
  assert.deepEqual(matchSpcOutlook([feature(3,geometry)],[venue],3,`${SPC_BASE}/17`),{});
  const valid=feature(4,{type:'Polygon',coordinates:square(-82,34,-78,38)});
  const matched=matchSpcOutlook([valid,feature(99,valid.geometry),{...valid,properties:{...valid.properties,expire:'bad'}}],[venue],3,`${SPC_BASE}/17`);
  assert.equal(matched.v1.length,1);
  assert.equal(matched.v1[0].category,'Slight');
  assert.equal(matched.v1[0].validAt,'2026-10-11T12:00:00.000Z');
});

test('only fresh kickoff-matched published outlook yields a forecast review candidate',()=>{
  const base={status:'ok',builtAt:'2026-10-10T00:00:00Z',sources:[{day:3,validAt:'2026-10-11T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z'}],byVenue:{v1:[{day:3,category:'Thunderstorm',categoryRank:2,validAt:'2026-10-11T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z',sourceUrl:`${SPC_BASE}/17`},{day:3,category:'Marginal',categoryRank:3,validAt:'2026-10-11T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z',sourceUrl:`${SPC_BASE}/17`}]}};
  const game={status:'scheduled in source; unreviewed',kickoff:'2026-10-11T17:00:00Z',venue:{id:'v1'}};
  assert.equal(selectSpcForGame(game,base,Date.parse('2026-10-10T01:00:00Z')).match.category,'Marginal');
  assert.equal(selectSpcForGame({...game,kickoff:'2026-10-13T17:00:00Z'},base,Date.parse('2026-10-10T01:00:00Z')).match,null);
  assert.equal(selectSpcForGame({...game,kickoff:'2026-10-13T17:00:00Z'},base,Date.parse('2026-10-10T01:00:00Z')).state,'outside published Day 1–3 window');
  assert.equal(selectSpcForGame({...game,venue:{id:'v2'}},base,Date.parse('2026-10-10T01:00:00Z')).state,'no point match in current Day 1–3 outlook');
  assert.equal(selectSpcForGame(game,base,Date.parse('2026-10-10T13:00:00Z')).state,'stale or unavailable');
  assert.equal(selectSpcForGame({...game,timeTbd:true},base,Date.parse('2026-10-10T01:00:00Z')).state,'not screenable');
});

test('committed SPC snapshot has three bounded NOAA layers and source-linked venue matches',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../site/spc_outlooks.json',import.meta.url)));
  assert.equal(data.status,'ok');
  assert.deepEqual(data.sources.map(item=>item.day),[1,2,3]);
  assert.ok(Object.values(data.byVenue).flat().length>0);
  for(const item of Object.values(data.byVenue).flat()){
    assert.ok(item.categoryRank>=2&&item.categoryRank<=8);
    assert.ok(Date.parse(item.expiresAt)>Date.parse(item.validAt));
    assert.match(item.sourceUrl,/^https:\/\/mapservices\.weather\.noaa\.gov\//);
  }
});
