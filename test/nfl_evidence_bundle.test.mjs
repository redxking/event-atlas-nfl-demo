import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';

test('public evidence export retains source links and gaps without person or police record details',()=>{
  const now=Date.parse('2026-10-09T20:00:00Z');
  const game={id:'nfl:sample',title:'Visitor at Seattle',week:5,kickoff:'2026-10-11T20:00:00Z',timeTbd:false,status:'scheduled in source',sourceUrl:'https://example.com/game',sourceRetrievedAt:'2026-10-09T19:55:00Z',secretRoster:'should not export',venue:{id:'3673',name:'Lumen Field',address:'Seattle, WA, USA',lat:47.5952,lon:-122.3316,coordinateStatus:'unreviewed',privateGate:'should not export'}};
  const inputs={schedule:{builtAt:'2026-10-09T19:55:00Z'},ground:{builtAt:'2026-10-09T19:00:00Z',byVenue:{3673:{sourceUrl:'https://www.openstreetmap.org/way/1',sourceVersion:2,sourceEditedAt:'2026-01-01T00:00:00Z',identityMethod:'wikidata',ring:[[-122.3,47.5],[-122.4,47.5],[-122.3,47.6]],privateNotes:'should not export'}}},airspace:{builtAt:'2026-10-09T19:50:00Z',sourceItemUrl:'https://faa.gov/source',byGame:{'nfl:sample':{objectId:1,startAt:'2026-10-11T19:00:00Z',endAt:'2026-10-12T01:00:00Z',status:'SCHEDULED',ring:[[-122.3,47.5]],privateNotes:'should not export'}}},cameras:{builtAt:'2026-10-09T19:50:00Z',byVenue:{3673:[{id:'wsdot-1',agency:'WSDOT',name:'Road image',distanceKm:1,sourceUrl:'https://agency.gov/layer',stillUrl:'https://images.wsdot.wa.gov/nw/test.jpg',privateCredential:'should not export'}]}},roads:{builtAt:'2026-10-09T19:50:00Z',coverageFrom:'2026-10-09T00:00:00Z',coverageThrough:'2026-10-15T00:00:00Z',byVenue:{3673:[{id:'road-1',agency:'WSDOT',kind:'Closure',name:'Route',distanceKm:2,startAt:'2026-10-11T19:00:00Z',endAt:'2026-10-11T22:00:00Z',sourceUrl:'https://agency.gov/road',privateNote:'should not export'}]}},conditions:{at:now,alerts:{features:[]},quakes:{features:[{id:'usgs-1',properties:{title:'M 2.6 sample',url:'https://earthquake.usgs.gov/1',mag:2.6,time:now-3600000,privateNote:'should not export'},geometry:{coordinates:[-122.35,47.6,2]}}]}},police:{state:'retrieved',checkedAt:now,context:{nearby:3,windowCount:null,gameWindowCurrent:false,newestUpdate:now-60000,caseIds:'should not export'}},ntas:{status:'ok',retrievedAt:'2026-10-09T19:55:00Z',sourceUrl:'https://www.dhs.gov/ntas/1.1/feed.xml',active:[{type:'Bulletin',url:'https://dhs.gov/item',privateNote:'should not export'}]}};
  const bundle=buildNflEvidenceBundle(game,inputs,now);
  assert.equal(bundle.status,'unreviewed_public_source_export');
  assert.equal(bundle.event.sourceUrl,game.sourceUrl);
  assert.equal(bundle.geography.ground.status,'unreviewed_osm_candidate');
  assert.equal(bundle.geography.airspace.record.status,'SCHEDULED');
  assert.equal(bundle.geography.zoneRegistry.status,'research_geometry_only');
  assert.ok(bundle.geography.zoneRegistry.gaps.some(gap=>gap.includes('operator-approved')));
  assert.equal(bundle.publicObservations.roads[0].sourceUrl,'https://agency.gov/road');
  assert.equal(bundle.publicObservations.cameras[0].stillUrl,'https://images.wsdot.wa.gov/nw/test.jpg');
  assert.equal(bundle.publicObservations.earthquakes[0].sourceUrl,'https://earthquake.usgs.gov/1');
  assert.equal(bundle.publicObservations.nationalAdvisory.active[0].url,'https://dhs.gov/item');
  assert.equal(bundle.picture.assessment.severity,'not_assessed');
  assert.ok(bundle.picture.gaps.some(gap=>gap.includes('NOTAM')));
  assert.equal(bundle.protectedPeople.state,'not_collected_in_public_demo');
  assert.ok(!JSON.stringify(bundle).includes('should not export'));
});
