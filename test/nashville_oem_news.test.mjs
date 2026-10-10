import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNashvilleOemNews} from '../site/nashville_oem_news.js';

const now=Date.parse('2026-10-10T12:00:00Z');
const game={venue:{id:'3810'},kickoff:'2026-10-11T17:00:00Z'};
const snapshot={schema:'event-atlas.nashville-oem-news.v1',status:'ok',sourceUrl:'https://www.nashville.gov/departments/emergency-management/news',checkedAt:'2026-10-10T11:30:00Z',lastPublishedAt:'2026-09-18T18:54:01Z',recent:[]};

test('checked newsroom with no recent releases is not an all-clear',()=>{
  const selected=selectNashvilleOemNews(game,snapshot,now);
  assert.equal(selected.state,'current_newsroom_check');
  assert.equal(selected.recent.length,0);
  assert.equal(selected.lastPublishedAt,snapshot.lastPublishedAt);
});

test('stale or cross-venue snapshot does not become current Nashville context',()=>{
  assert.equal(selectNashvilleOemNews(game,{...snapshot,checkedAt:'2026-10-10T08:00:00Z'},now).state,'stale_or_unavailable');
  assert.equal(selectNashvilleOemNews({...game,venue:{id:'3493'}},snapshot,now).state,'outside_near_term_city_scope');
});
