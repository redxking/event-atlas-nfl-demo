import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';

const now=Date.parse('2026-10-09T18:00:00Z');
const game={id:'nfl:demo',kickoff:'2026-10-11T20:00:00Z',timeTbd:false,status:'scheduled in source',sourceRetrievedAt:'2026-10-09T17:55:00Z',venue:{id:'3687',lat:32.747,lon:-97.094}};
const inputs={schedule:{builtAt:'2026-10-09T17:55:00Z'},ground:{byVenue:{3687:{sourceEditedAt:'2026-09-01T00:00:00Z',identityMethod:'wikidata'}}},airspace:{builtAt:'2026-10-09T17:50:00Z',byGame:{'nfl:demo':{sourceUpdatedAt:'2026-10-09T16:00:00Z'}}},cameras:{builtAt:'2026-10-09T17:50:00Z',byVenue:{3687:[]}},roads:{builtAt:'2026-10-09T17:50:00Z',coverageFrom:'2026-10-09T17:00:00Z',coverageThrough:'2026-10-16T17:00:00Z',byVenue:{3687:[{id:'road:1',kind:'Closure',name:'Example Road',agency:'Agency',distanceKm:2,startAt:'2026-10-11T19:00:00Z',endAt:'2026-10-11T22:00:00Z',sourceUrl:'https://example.gov/road/1'}]}},conditions:{at:now,alerts:{features:[{id:'nws:1',properties:{event:'Severe thunderstorm',severity:'Severe',urgency:'Immediate',status:'Actual',effective:'2026-10-11T19:00:00Z',expires:'2026-10-11T21:00:00Z','@id':'https://api.weather.gov/alerts/1'}}]}},police:{state:'retrieved',checkedAt:now,context:{nearby:1}}};

test('event picture preserves source-linked review cues without making a threat assessment',()=>{
  const picture=buildNflEventPicture(game,inputs,now);
  assert.equal(picture.cueCounts.weather,1);
  assert.equal(picture.cueCounts.road,1);
  assert.equal(picture.cues.length,2);
  assert.equal(picture.cues[0].sourceUrl,'https://api.weather.gov/alerts/1');
  assert.equal(picture.cues[1].sourceUrl,'https://example.gov/road/1');
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
  assert.ok(picture.gaps.some(gap=>gap.includes('stadium CCTV')));
  assert.equal(picture.zoneReview.find(zone=>zone.name==='Stadium ground perimeter').state,'unreviewed mapped candidate');
  assert.equal(picture.zoneReview.find(zone=>zone.name==='FAA event airspace').state,'source snapshot; NOTAM unverified');
  assert.equal(picture.zoneReview.find(zone=>zone.name==='Drone detections').state,'no connected detection source');
  assert.ok(picture.gaps.some(gap=>gap.includes('active jurisdictional police alert')));
});

test('stale observations and unknown kickoff do not create time-aligned cues',()=>{
  const stale=buildNflEventPicture(game,{...inputs,roads:{...inputs.roads,builtAt:'2026-10-08T00:00:00Z'},conditions:{...inputs.conditions,at:now-3600000}},now);
  assert.equal(stale.cues.length,0);
  assert.equal(stale.cueCounts.weather,0);
  assert.equal(stale.cueCounts.road,0);
  const tbd=buildNflEventPicture({...game,timeTbd:true},inputs,now);
  assert.equal(tbd.cues.length,0);
  assert.ok(tbd.gaps.some(gap=>gap.includes('Road event-time matching')));
});

test('missing sources are gaps rather than zero-incident findings',()=>{
  const picture=buildNflEventPicture({...game,venue:{...game.venue,id:'other'}},{schedule:inputs.schedule},now);
  assert.equal(picture.cues.length,0);
  assert.equal(picture.sources.find(source=>source.name==='Local police activity').state,'no connector');
  assert.ok(picture.gaps.some(gap=>gap.includes('No jurisdictional police incident feed')));
  assert.equal(picture.zoneReview.find(zone=>zone.name==='Stadium ground perimeter').state,'no mapped candidate');
});

test('Seattle closed-call context is labeled and never becomes a threat cue',()=>{
  const seattle={...game,venue:{...game.venue,id:'3673',lat:47.5952,lon:-122.3316}};
  const picture=buildNflEventPicture(seattle,{schedule:inputs.schedule,police:{state:'retrieved',checkedAt:now,context:{nearby:5}}},now);
  const source=picture.sources.find(item=>item.name==='Local police activity');
  assert.equal(source.state,'public call count checked');
  assert.match(source.detail,/closed CAD responses/);
  assert.equal(picture.cues.length,0);
  assert.equal(picture.assessment.severity,'not_assessed');
  assert.ok(!picture.gaps.some(gap=>gap.includes('No jurisdictional police incident feed')));
});

test('Chicago historical count stays a dated aggregate and never becomes a threat cue',()=>{
  const chicago={...game,venue:{...game.venue,id:'3933',lat:41.8625,lon:-87.6167}};
  const picture=buildNflEventPicture(chicago,{schedule:inputs.schedule,police:{state:'retrieved',sourceId:'chicago',checkedAt:now,context:{nearby:83,start:'2026-09-01',end:'2026-10-01',radiusKm:5,caseNumber:'private'}}},now);
  const source=picture.sources.find(item=>item.name==='Local police activity');
  assert.equal(source.state,'delayed historical count checked');
  assert.deepEqual(picture.policeContext,{nearby:83,start:'2026-09-01',end:'2026-10-01',radiusKm:5});
  assert.ok(picture.gaps.some(gap=>gap.includes('no active police alert feed')));
  assert.equal(picture.cues.length,0);
});

test('Indianapolis delayed calls remain historical context with no threat cue',()=>{
  const indy={...game,venue:{...game.venue,id:'3812',lat:39.760056,lon:-86.163806}};
  const context={nearby:123,start:'2026-10-01',end:'2026-10-08',radiusKm:5,sourceLatestAt:now-30*3600000,sourceLagHours:30,privateAddress:'must not export'};
  const picture=buildNflEventPicture(indy,{schedule:inputs.schedule,police:{state:'retrieved',sourceId:'indianapolis',checkedAt:now-2*3600000,context}},now);
  assert.equal(picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  assert.equal(picture.policeContext.nearby,123);
  assert.equal(picture.policeContext.privateAddress,undefined);
  assert.equal(picture.cues.length,0);
  assert.ok(picture.gaps.some(gap=>gap.includes('delayed seven-day aggregate')));
});

test('Charlotte delayed incident reports remain historical context with no threat cue',()=>{
  const charlotte={...game,venue:{...game.venue,id:'3628',lat:35.225833333,lon:-80.852777777}};
  const context={nearby:403,start:'2026-10-01',end:'2026-10-08',radiusKm:5,sourceLatestAt:now-45*3600000,sourceLagHours:45,privateAddress:'must not export'};
  const picture=buildNflEventPicture(charlotte,{schedule:inputs.schedule,police:{state:'retrieved',sourceId:'charlotte',checkedAt:now-2*3600000,context}},now);
  assert.equal(picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  assert.equal(picture.policeContext.nearby,403);
  assert.equal(picture.policeContext.privateAddress,undefined);
  assert.equal(picture.cues.length,0);
  assert.ok(picture.gaps.some(gap=>gap.includes('noncriminal and potentially unfounded')));
});

test('Charlotte open CMPD roadway check is source context, not a police alert or threat cue',()=>{
  const charlotte={...game,venue:{...game.venue,id:'3628',lat:35.225833333,lon:-80.852777777}};
  const picture=buildNflEventPicture(charlotte,{schedule:inputs.schedule,cmpdTraffic:{state:'retrieved',checkedAt:now,totalOpen:12,nearby:2,invalidCount:0,newestNearbyAt:'2026-10-09T17:00:00Z',sourceUrl:'https://cmpdinfo.charlottenc.gov/api/v2.1/TrafficRSS',interpretation:'Open roadway context only',privateTitle:'Do not export'}},now);
  assert.equal(picture.sources.find(item=>item.name==='CMPD open roadway incidents').state,'open-feed count checked');
  assert.equal(picture.openRoadwayContext.nearby,2);
  assert.equal(picture.openRoadwayContext.privateTitle,undefined);
  assert.equal(picture.cues.length,0);
  assert.ok(picture.gaps.some(gap=>gap.includes('No active jurisdictional police alert')));
});

test('failed direct Tennessee road check is visible as a gap',()=>{
  const nashville={...game,venue:{...game.venue,id:'3810',lat:36.1663,lon:-86.7713}};
  const picture=buildNflEventPicture(nashville,{schedule:inputs.schedule,roadDirect:{state:'failed',checkedAt:now}},now);
  assert.ok(picture.gaps.some(gap=>gap.includes('Direct Tennessee DOT SmartWay check failed')));
  assert.equal(picture.cueCounts.road,0);
});
