import test from 'node:test';
import assert from 'node:assert/strict';
import {phillyLanePermitQuery,summarizePhillyLanePermits} from '../site/philly_lane_permits.js';

const venue={id:'3806',lat:39.90089,lon:-75.16776};
const now=Date.parse('2026-10-10T02:00:00Z');
const game={id:'nfl:philly',kickoff:'2026-10-18T17:00:00Z',venue};
const line=(id,permitNumber,start='2026-10-01',end='2026-10-31')=>({type:'Feature',geometry:{type:'LineString',coordinates:[[-75.168,39.900],[-75.169,39.901]]},properties:{objectid:id,permitnumber:permitNumber,status:'Current',occupancytype:'Partial Closure',permittype:'Utility Work',address:'3900 block of S 11TH ST',effectivedate:Date.parse(`${start}T00:00:00Z`),expirationdate:Date.parse(`${end}T00:00:00Z`)}});

test('Philadelphia permit query is bounded by point, distance, source status and season dates',()=>{
  const url=new URL(phillyLanePermitQuery(venue,now,Date.parse('2027-01-10T18:00:00Z')));
  assert.equal(url.searchParams.get('distance'),'2000');
  assert.equal(url.searchParams.get('resultRecordCount'),'500');
  assert.equal(url.searchParams.get('geometry'),'-75.16776,39.90089');
  assert.match(url.searchParams.get('where'),/status IN \('Current','Future'\).*expirationdate >= TIMESTAMP '2026-10-10 00:00:00'/);
});

test('Philadelphia permit snapshot deduplicates street segments and screens only game calendar date',()=>{
  const data={type:'FeatureCollection',features:[line(1,'P-1'),line(2,'P-1'),line(3,'P-2','2026-10-19','2026-10-31')]};
  const summary=summarizePhillyLanePermits(data,[game],venue,now);
  assert.equal(summary.byGame[game.id].segmentCount,2);
  assert.equal(summary.byGame[game.id].permitCount,1);
  assert.equal(summary.byGame[game.id].nearest[0].permitNumber,'P-1');
  assert.equal(summary.byGame[game.id].nearest[0].distanceKm<=2,true);
  assert.throws(()=>summarizePhillyLanePermits({...data,exceededTransferLimit:true},[game],venue,now),/incomplete/);
});
