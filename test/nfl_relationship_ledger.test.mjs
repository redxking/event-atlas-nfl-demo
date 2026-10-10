import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflRelationshipLedger} from '../site/nfl_relationship_ledger.js';

const game={id:'nfl:401873006',title:'Chargers at Chiefs',kickoff:'2026-10-18T20:25:00Z',sourceUrl:'https://www.espn.com/nfl/game/_/gameId/401873006',sourceRetrievedAt:'2026-10-10T14:00:00Z',venue:{id:'3735',name:'Arrowhead Stadium'}};
const cue={type:'road condition',sourceId:'agency:work-7',title:'Agency work zone',basis:'Road source window overlaps listed event; 2 km from candidate point.',sourceUrl:'https://example.gov/roads/7',sourceAt:'2026-10-10T13:00:00Z'};

test('relationship ledger separates exact game, repeated cue, regional news, exclusion and conflict',()=>{
  const picture={eventId:game.id,cues:[cue,{...cue}],gaps:['No CCTV','No drone sensor'],gameArticle:{state:'current_snapshot',article:{headline:'Game preview',url:'https://www.espn.com/nfl/story/_/id/1/game-preview',publishedAt:'2026-10-10T12:00:00Z'}},directGame:{state:'checked',scheduleDiffers:true,sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401873006',checkedAt:'2026-10-10T14:01:00Z'}};
  const roads=[{id:'agency:work-7',kind:'work',name:'Near venue',startAt:'2026-10-18T18:00:00Z',endAt:'2026-10-19T00:00:00Z',distanceKm:2,sourceUrl:'https://example.gov/roads/7'},{id:'agency:old-8',kind:'work',name:'Earlier closure',startAt:'2026-10-15T10:00:00Z',endAt:'2026-10-15T12:00:00Z',distanceKm:3,sourceUrl:'https://example.gov/roads/8'}];
  const news={state:'current_snapshot',teamDiscovery:[{title:'Chiefs team update',publisher:'Example',matchBasis:'one_team_mentioned',url:'https://example.com/team',publishedAt:'2026-10-10T11:00:00Z'}]};
  const ledger=buildNflRelationshipLedger(game,picture,{news,roads});
  assert.deepEqual(ledger.counts,{direct_event_record:2,time_place_candidate:1,regional_context:1,contradictory_record:1,excluded_link:1});
  assert.equal(ledger.coverageGapCount,2);
  assert.equal(ledger.candidateCueTotal,2);
  const candidate=ledger.items.find(item=>item.relationship==='time_place_candidate');
  assert.equal(candidate.duplicateCueCount,2);
  assert.equal(candidate.validityStart,'2026-10-18T18:00:00.000Z');
  assert.equal(candidate.possibleImpact,'not_assessed');
  assert.equal(candidate.sourceIndependence,'same_source_key_not_independent');
  assert.equal(candidate.sourceTimeBasis,'publisher record date or validity start');
  assert.match(ledger.items.find(item=>item.relationship==='excluded_link').basis,/does not overlap/);
  assert.equal(ledger.items.find(item=>item.relationship==='regional_context').disposition,'discovery_only');
  assert.equal(ledger.items.find(item=>item.relationship==='contradictory_record').disposition,'disputed_pending_review');
  assert.ok(ledger.items.every(item=>item.alternative&&item.ruleId));
});

test('date-only regional advisory stays discovery context rather than event impact',()=>{
  const picture={eventId:game.id,cues:[{type:'regional road advisory',sourceId:'az511:notice',title:'Phoenix corridor notice',basis:'Game date overlaps notice date; exact route and hours unknown.',sourceUrl:'https://az511.gov/List/Alerts',sourceAt:'2026-10-10T12:00:00Z'}],gaps:[]};
  const ledger=buildNflRelationshipLedger(game,picture);
  assert.equal(ledger.counts.time_place_candidate,0);
  assert.equal(ledger.counts.regional_context,1);
  assert.equal(ledger.items.find(item=>item.ruleId==='REGIONAL_NOTICE_DATE_TEXT').possibleImpact,'not_assessed');
});

test('changed kickoff rescreens a previously excluded road without asserting impact',()=>{
  const picture={eventId:game.id,cues:[],gaps:[],gameArticle:{state:'unavailable'},directGame:null};
  const roads=[{id:'agency:work-1',startAt:'2026-10-15T10:00:00Z',endAt:'2026-10-15T12:00:00Z',distanceKm:2,sourceUrl:'https://example.gov/roads/1'}];
  const before=buildNflRelationshipLedger(game,picture,{roads});
  const after=buildNflRelationshipLedger({...game,kickoff:'2026-10-15T13:00:00Z'},picture,{roads});
  assert.equal(before.counts.excluded_link,1);
  assert.equal(after.counts.excluded_link,0);
  assert.ok(after.items.every(item=>item.possibleImpact==='not_assessed'));
});
