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
});
