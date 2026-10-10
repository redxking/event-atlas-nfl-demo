import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectRidekcArrowhead} from '../site/ridekc_arrowhead.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const schedule=JSON.parse(fs.readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(fs.readFileSync(new URL('../site/ridekc_arrowhead.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401873006');

test('RideKC dated timetable and Route 47 notice enter only the matching event brief',()=>{
  const now=Date.parse(snapshot.checkedAt)+60000;
  const selected=selectRidekcArrowhead(game,snapshot,now);
  assert.equal(selected.state,'current_static_schedule');
  assert.equal(selected.routes[0].routeShortName,'47');
  assert.equal(selected.routes[0].nearestStops[0].distanceKm,0.72);
  assert.equal(selected.alertState,'route_change_notice_listed');
  const bundle=buildNflEvidenceBundle(game,{schedule,ridekcArrowhead:snapshot},now);
  assert.equal(bundle.publicObservations.ridekcArrowheadTransit.state,'current_static_schedule');
  const report=buildNflPublicReport(bundle);
  assert.match(report,/RideKC dated transit planning near Arrowhead/);
  assert.match(report,/static timetable entries, not live vehicle locations or confirmed October 18 service/);
  assert.equal(selectRidekcArrowhead({...game,id:'nfl:other'},snapshot,now).state,'outside_source_event');
});

test('stale and altered RideKC data cannot be treated as current service',()=>{
  const now=Date.parse(snapshot.checkedAt)+13*3600000;
  assert.equal(selectRidekcArrowhead(game,snapshot,now).state,'stale_or_unavailable');
  const altered=structuredClone(snapshot);
  altered.nearbyRoutes[0].nearestStops[0].distanceKm=25;
  assert.equal(selectRidekcArrowhead(game,altered,Date.parse(snapshot.checkedAt)+60000).state,'stale_or_unavailable');
});
