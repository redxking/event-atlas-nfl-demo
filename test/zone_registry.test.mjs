import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVenueZoneRegistry,screenPointAgainstZones} from '../site/zone_registry.js';

const ring=[[-97.1,32.74],[-97.09,32.74],[-97.09,32.75],[-97.1,32.75],[-97.1,32.74]];
const game={id:'synthetic-game',venue:{id:'synthetic-stadium'}};

test('ground and FAA polygons remain separately typed and time screened',()=>{
  const zones=buildVenueZoneRegistry(game,{ground:{byVenue:{'synthetic-stadium':{ring,sourceUrl:'https://www.openstreetmap.org/way/1',sourceVersion:2}}},airspace:{sourceItemUrl:'https://faa.example/record',byGame:{'synthetic-game':{ring,startAt:'2026-10-11T19:00:00Z',endAt:'2026-10-11T23:00:00Z'}}},tfr:{byVenue:{'synthetic-stadium':[{notamId:'6/1234',ring,detailUrl:'https://tfr.faa.gov/tfr3/',windowState:'complex_or_unverified'}]}}});
  assert.deepEqual(zones.zones.map(zone=>zone.type),['ground_footprint_candidate','published_airspace_restriction','published_airspace_notice_candidate']);
  const hit=screenPointAgainstZones(zones,{lat:32.745,lon:-97.095,observedAt:'2026-10-11T20:00:00Z'});
  assert.equal(hit.length,3);
  assert.equal(hit[0].timeRelation,'unverified');
  assert.equal(hit[1].timeRelation,'within_published_window');
  assert.equal(hit[2].timeRelation,'unverified');
  assert.equal(hit[1].relation,'inside_published_geometry');
  assert.equal(screenPointAgainstZones(zones,{lat:32.745,lon:-97.095,observedAt:'2026-10-12T20:00:00Z'})[1].timeRelation,'outside_published_window');
  assert.deepEqual(screenPointAgainstZones(zones,{lat:32.8,lon:-97.095}),[]);
  assert.match(zones.gaps[1],/do not.*detect drones/);
});

test('invalid and incomplete source geometry is excluded from correlation',()=>{
  const zones=buildVenueZoneRegistry(game,{ground:{byVenue:{'synthetic-stadium':{ring:ring.slice(0,-1)}}},airspace:{byGame:{'synthetic-game':{ring:[[-97,32],[-96,32]]}}}});
  assert.equal(zones.zones.length,0);
  assert.throws(()=>screenPointAgainstZones(zones,{lat:91,lon:0}),/Valid observation point/);
});
