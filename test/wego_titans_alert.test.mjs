import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWeGoTitansAlert,compareNashvilleAccessPlans} from '../site/wego_titans_alert.js';

const now=Date.parse('2026-10-10T12:30:00Z');
const game={id:'nfl:401872984',venue:{id:'3810'},kickoff:'2026-10-11T17:00:00Z',timeTbd:false};
const snapshot={schema:'event-atlas.wego-titans-alert.v1',status:'ok',checkedAt:'2026-10-10T12:00:00Z',gameId:game.id,venueId:'3810',sourceUrl:'https://www.wegotransit.com/ride/alerts/',sourceWindowText:'Sun October 11, 2026 10:00 AM-Sun October 11, 2026 4:00 PM',startAt:'2026-10-11T15:00:00Z',endAt:'2026-10-11T21:00:00Z',routeNumbers:['14','23','41','56'],summary:'Routes 14, 23, 41, and 56 will travel using Woodland St to S 5th St inbound and outbound from 10 a.m. until 4 p.m. Nissan Stadium Stop is Woodland & S 1st. No Service on N 1st or S 1st Street.',sourceTextSha256:'a'.repeat(64)};

test('exact-game WeGo notice retains its operator scope',()=>{
  const context=selectWeGoTitansAlert(game,snapshot,now);
  assert.equal(context.state,'current_operator_notice');
  assert.deepEqual(context.routeNumbers,['14','23','41','56']);
  assert.equal(selectWeGoTitansAlert(game,{...snapshot,checkedAt:'2026-10-10T09:00:00Z'},now).state,'stale_or_unavailable');
  assert.equal(selectWeGoTitansAlert({...game,venue:{id:'3493'}},snapshot,now).state,'outside_exact_game_scope');
});

test('NDOT and WeGo comparison reports only published time and place overlap',()=>{
  const wego=selectWeGoTitansAlert(game,snapshot,now);
  const ndot={state:'current_published_plan',plannedStartAt:'2026-10-11T13:00:00Z',plannedEndAt:'2026-10-11T22:00:00Z',sourceUrl:'https://www.nashville.gov/weekly.pdf'};
  const result=compareNashvilleAccessPlans(game,ndot,wego);
  assert.equal(result.state,'source_overlap_review');
  assert.equal(result.overlapStartAt,'2026-10-11T15:00:00.000Z');
  assert.equal(result.overlapEndAt,'2026-10-11T21:00:00.000Z');
  assert.equal(compareNashvilleAccessPlans(game,ndot,{...wego,state:'stale_or_unavailable'}).state,'unavailable');
});
