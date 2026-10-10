import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNashvilleTitansClosures} from '../site/nashville_titans_closures.js';

const now=Date.parse('2026-10-10T12:30:00Z');
const game={id:'nfl:401872984',venue:{id:'3810'},kickoff:'2026-10-11T17:00:00Z',timeTbd:false};
const sourceUrl='https://www.nashville.gov/sites/default/files/2026-10/ROWConstructionRoadClosures-Weekof_101026-101726.pdf?ct=1791578264';
const permits=[['2026080985','WOODLAND ST'],['2026081000','S 1ST ST'],['2026081007','RUSSELL ST'],['2026081013','TITANS WAY'],['2026081031','VICTORY AVE'],['2026081033','S 1ST ST'],['2026081036','CRUTCHER ST']];
const segments=['WOODLAND ST bet 3rd Ave N to S 5th St','S 1ST ST bet Woodland St to Russell St','RUSSELL ST bet S 1st St to Titans Way','TITANS WAY / RUSSELL ST - VICTORY LN','VICTORY AVE / TITANS WAY - 2ND AVE','S 1ST ST/ VICTORY LN - DAVIDSON ST','CRUTCHER ST/ S 2ND ST - S 5TH ST'];
const snapshot={schema:'event-atlas.nashville-titans-closures.v1',status:'ok',checkedAt:'2026-10-10T12:00:00Z',gameId:game.id,eventDate:'2026-10-11',sourceIndexUrl:'https://www.nashville.gov/departments/transportation/road-closures',sourceUrl,documentSha256:'a'.repeat(64),reportWindow:'2026-10-10/2026-10-17',entries:permits.map(([permitNumber,street],i)=>({permitNumber,street,publishedSegment:segments[i],date:'2026-10-11',plannedStartLocal:'08:00',plannedEndLocal:'17:00',sourceUrl,sourceTextSha256:'b'.repeat(64)}))};

test('exact-game NDOT permits remain a sourced published plan',()=>{
  const context=selectNashvilleTitansClosures(game,snapshot,now);
  assert.equal(context.state,'current_published_plan');
  assert.equal(context.entries.length,7);
  assert.equal(context.plannedStartAt,'2026-10-11T13:00:00Z');
  assert.equal(context.plannedEndAt,'2026-10-11T22:00:00Z');
});

test('stale, incomplete, and mismatched permits are unavailable',()=>{
  assert.equal(selectNashvilleTitansClosures(game,{...snapshot,checkedAt:'2026-10-10T09:00:00Z'},now).state,'stale_or_unavailable');
  assert.equal(selectNashvilleTitansClosures(game,{...snapshot,entries:snapshot.entries.slice(1)},now).state,'stale_or_unavailable');
  assert.equal(selectNashvilleTitansClosures({...game,venue:{id:'3493'}},snapshot,now).state,'outside_exact_game_scope');
});
