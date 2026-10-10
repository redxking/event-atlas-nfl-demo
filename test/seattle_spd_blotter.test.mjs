import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSeattleSpdBlotter} from '../site/seattle_spd_blotter.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const now=Date.parse('2026-10-10T14:00:00Z');
const game={id:'nfl:401872992',title:'Seahawks vs 49ers',kickoff:'2026-10-11T20:00:00Z',venue:{id:'3673',name:'Lumen Field',lat:47.5952,lon:-122.3316}};
const snapshot={schema:'event-atlas.seattle-spd-blotter.v1',status:'ok',checkedAt:'2026-10-10T13:45:00Z',sourceBuildAt:'2026-10-10T13:35:25Z',sourceUrl:'https://spdblotter.seattle.gov/feed/',recent:[{title:'City notice',publishedAt:'2026-10-10T13:35:19Z',url:'https://spdblotter.seattle.gov/2026/10/10/city-notice/'}]};

test('Seattle police headlines are citywide source context with dated citations',()=>{
  const selected=selectSeattleSpdBlotter(game,snapshot,now);
  assert.equal(selected.state,'current_citywide_headlines');
  const bundle=buildNflEvidenceBundle(game,{seattleSpdBlotter:snapshot},now);
  assert.equal(bundle.publicObservations.seattlePoliceDatedHeadlines.recent.length,1);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Seattle Police dated public headlines/);
  assert.match(report,/citywide article titles for discovery/i);
  assert.doesNotMatch(report,/confirmed stadium incident/i);
});

test('stale, altered-source, and cross-venue headlines do not become current',()=>{
  assert.equal(selectSeattleSpdBlotter(game,{...snapshot,checkedAt:'2026-10-10T10:00:00Z'},now).state,'stale_or_unavailable');
  assert.equal(selectSeattleSpdBlotter(game,{...snapshot,recent:[{...snapshot.recent[0],url:'https://example.com/not-official'}]},now).state,'stale_or_unavailable');
  assert.equal(selectSeattleSpdBlotter({...game,venue:{...game.venue,id:'3810'}},snapshot,now).state,'outside_near_term_city_scope');
});
