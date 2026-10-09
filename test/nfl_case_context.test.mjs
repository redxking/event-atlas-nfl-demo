import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflCaseContext} from '../lib/build_nfl_case_context.mjs';

const now=Date.parse('2026-10-09T20:00:00Z');
const event={id:'nfl:synthetic',sourceId:'nfl',title:'Synthetic visitors at hosts',startsAtLocal:'2026-10-11T20:00:00Z',status:'scheduled in source',sourceUrl:'https://example.org/game'};
const game={id:event.id,title:event.title,kickoff:event.startsAtLocal,status:event.status,sourceUrl:event.sourceUrl,sourceRetrievedAt:'2026-10-09T19:55:00Z',week:5,timeTbd:false,venue:{id:'synthetic-venue',name:'Synthetic Stadium',address:'Example, USA',lat:40,lon:-75,coordinateStatus:'unreviewed'}};
const subject={id:event.id,sourceId:'nfl'};

test('matched NFL case carries bounded sourced context without assessed threat',()=>{
  const result=buildNflCaseContext(subject,event,{schedule:{builtAt:'2026-10-09T19:55:00Z',games:[game]}},now);
  assert.equal(result.status,'snapshot_available_unreviewed');
  assert.equal(result.evidence.event.id,event.id);
  assert.equal(result.evidence.picture.assessment.severity,'not_assessed');
  assert.equal(result.evidence.geography.zoneRegistry.status,'research_geometry_only');
  assert.ok(result.evidence.picture.gaps.some(gap=>gap.includes('police alert')));
});

test('changed game and stale schedule cannot masquerade as current matched context',()=>{
  const schedule={builtAt:'2026-10-09T19:55:00Z',games:[game]};
  const mismatch=buildNflCaseContext(subject,{...event,startsAtLocal:'2026-10-11T21:00:00Z'},{schedule},now);
  assert.equal(mismatch.status,'source_mismatch');
  assert.equal(mismatch.evidence,null);
  assert.match(mismatch.reason,/kickoff/);
  const stale=buildNflCaseContext(subject,event,{schedule:{...schedule,builtAt:'2026-10-08T00:00:00Z'}},now);
  assert.equal(stale.status,'stale_schedule_snapshot');
  assert.equal(buildNflCaseContext(subject,null,{schedule},now).status,'unavailable');
});

test('Indianapolis case includes only a current bounded public police aggregate',()=>{
  const indyGame={...game,venue:{...game.venue,id:'3812'}};
  const context={nearby:17,start:'2026-10-01',end:'2026-10-08',radiusKm:5,sourceLatestAt:now-30*3600000,sourceLagHours:30,checkedAt:now-3600000,privateAddress:'must not export'};
  const snapshots={schedule:{builtAt:'2026-10-09T19:55:00Z',games:[indyGame]},indianapolis:{status:'ok',builtAt:new Date(now-3600000).toISOString(),byVenue:{3812:context}}};
  const result=buildNflCaseContext(subject,event,snapshots,now);
  assert.equal(result.evidence.publicObservations.policeAggregate.nearby,17);
  assert.equal(result.evidence.publicObservations.policeAggregate.privateAddress,undefined);
  assert.equal(result.evidence.picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  const stale=buildNflCaseContext(subject,event,{...snapshots,indianapolis:{...snapshots.indianapolis,builtAt:new Date(now-13*3600000).toISOString()}},now);
  assert.equal(stale.evidence.publicObservations.policeAggregate,null);
});

test('Charlotte case includes only a current bounded public police aggregate',()=>{
  const charlotteGame={...game,venue:{...game.venue,id:'3628'}};
  const context={nearby:403,start:'2026-10-01',end:'2026-10-08',radiusKm:5,sourceLatestAt:now-45*3600000,sourceLagHours:45,checkedAt:now-3600000,reportId:'must not export'};
  const snapshots={schedule:{builtAt:'2026-10-09T19:55:00Z',games:[charlotteGame]},charlotte:{status:'ok',builtAt:new Date(now-3600000).toISOString(),byVenue:{3628:context}}};
  const result=buildNflCaseContext(subject,event,snapshots,now);
  assert.equal(result.evidence.publicObservations.policeAggregate.nearby,403);
  assert.equal(result.evidence.publicObservations.policeAggregate.reportId,undefined);
  assert.equal(result.evidence.picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  const stale=buildNflCaseContext(subject,event,{...snapshots,charlotte:{...snapshots.charlotte,builtAt:new Date(now-13*3600000).toISOString()}},now);
  assert.equal(stale.evidence.publicObservations.policeAggregate,null);
});

test('Gillette case retains current bounded MBTA context and marks failed checks as gaps',()=>{
  const foxboroGame={...game,venue:{...game.venue,id:'3738'}};
  const schedule={builtAt:'2026-10-09T19:55:00Z',games:[foxboroGame]};
  const transit={state:'retrieved',checkedAt:now-60000,stopId:'place-FS-0049',stopName:'Foxboro',stopDistanceKm:0.52,totalReturned:1,invalidCount:0,screenable:true,eventWindow:{start:'2026-10-11T16:00:00Z',end:'2026-10-12T01:00:00Z'},overlapCount:1,omittedAlertCount:0,sourceUrl:'https://api-v3.mbta.com/alerts?filter%5Bstop%5D=place-FS-0049',interpretation:'Transit context only',alerts:[{id:'test',header:'Synthetic station alert',effect:'SHUTTLE',lifecycle:'UPCOMING',updatedAt:'2026-10-09T19:55:00Z',periods:[{start:'2026-10-11T18:00:00Z',end:'2026-10-11T23:00:00Z'}],eventWindowOverlap:true,sourceUrl:'https://api-v3.mbta.com/alerts/test',privateNote:'must not export'}]};
  const transitSchedule={state:'retrieved',checkedAt:now-60000,stopId:'place-FS-0049',routeId:'CR-Foxboro',serviceDate:'2026-10-11',sourceUrl:'https://api-v3.mbta.com/schedules',totalReturned:1,invalidCount:0,arrivalCount:1,departureCount:0,screenable:true,eventWindow:{start:'2026-10-11T16:00:00Z',end:'2026-10-12T01:00:00Z'},withinWindowCount:1,omittedEntryCount:0,entries:[{id:'schedule-1',tripId:'PatsTrain-1',headsign:'Patriots Game Train',arrivalAt:'2026-10-11T15:05:00Z',departureAt:null,directionId:0,withinIllustrativeWindow:true,sourceUrl:'https://api-v3.mbta.com/trips/PatsTrain-1',privateNote:'must not export'}],interpretation:'Published schedule only'};
  const transitPredictions={state:'retrieved',checkedAt:now-60000,sourceUrl:'https://api-v3.mbta.com/predictions',stopId:'place-FS-0049',routeId:'CR-Foxboro',totalReturned:1,invalidCount:0,omittedEntryCount:0,entries:[{tripId:'game-1',headsign:'Game train',arrivalAt:'2026-10-09T20:10:00Z',departureAt:null,status:null,sourceUrl:'https://api-v3.mbta.com/trips/game-1',privateNote:'must not export'}],interpretation:'Current station estimate only'};
  const result=buildNflCaseContext(subject,event,{schedule,transit,transitSchedule,transitPredictions},now);
  assert.equal(result.evidence.picture.cueCounts.transit,1);
  assert.equal(result.evidence.publicObservations.stationAlerts.alerts[0].privateNote,undefined);
  assert.equal(result.evidence.publicObservations.stationSchedule.entries[0].headsign,'Patriots Game Train');
  assert.equal(result.evidence.publicObservations.stationSchedule.entries[0].privateNote,undefined);
  assert.equal(result.evidence.publicObservations.stationPredictions.entries[0].privateNote,undefined);
  assert.equal(result.evidence.picture.sources.find(item=>item.name==='MBTA Foxboro current predictions').state,'current predictions checked');
  assert.equal(result.evidence.picture.assessment.severity,'not_assessed');
  const failed=buildNflCaseContext(subject,event,{schedule,transit:{state:'failed',checkedAt:now},transitSchedule:{state:'failed',checkedAt:now},transitPredictions:{state:'failed',checkedAt:now}},now);
  assert.equal(failed.evidence.publicObservations.stationAlerts,null);
  assert.equal(failed.evidence.publicObservations.stationSchedule,null);
  assert.equal(failed.evidence.publicObservations.stationPredictions,null);
  assert.ok(failed.evidence.picture.gaps.some(gap=>gap.includes('MBTA Foxboro station alerts are unavailable')));
});
