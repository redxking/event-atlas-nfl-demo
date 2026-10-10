import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNifcSnapshot,selectNifcForGame} from '../site/nifc_wildfire.js';

const now=Date.parse('2026-10-10T12:00:00Z');
const game={venue:{id:'x',lat:34,lon:-118}};
const feature=(id,updated,geometry={x:-118.02,y:34.01},extra={})=>({attributes:{OBJECTID:id,IncidentName:'SOURCE FIRE',IncidentTypeCategory:'WF',IncidentSize:5,ModifiedOnDateTime_dt:updated,FireDiscoveryDateTime:updated-1000,FireOutDateTime:null,PercentContained:0,...extra},geometry});
test('NIFC snapshot keeps bounded recent wildfire points and source links',()=>{
  const snapshot=buildNifcSnapshot({features:[feature(7,now-60000),feature(8,now-4*86400000),feature(9,now-60000,{x:-70,y:40}),feature(10,now-60000,undefined,{FireOutDateTime:now})]},[game],now);
  const selected=selectNifcForGame(game,snapshot,now);
  assert.equal(selected.state,'current_snapshot');
  assert.deepEqual(selected.events.map(item=>item.id),[7]);
  assert.match(selected.events[0].sourceUrl,/\/7$/);
});
test('partial, stale, and failed source responses cannot yield a negative finding',()=>{
  assert.throws(()=>buildNifcSnapshot({features:[],exceededTransferLimit:true},[game],now));
  const snapshot=buildNifcSnapshot({features:[]},[game],now);
  assert.equal(selectNifcForGame(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectNifcForGame(game,{...snapshot,status:'failed'},now).state,'stale_or_unavailable');
  assert.equal(selectNifcForGame(game,snapshot,now,'season_planning').state,'not_started');
});
