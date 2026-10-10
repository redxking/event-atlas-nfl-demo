import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectJetsGamedayGuide} from '../site/jets_gameday_guide.js';
import {compareJetsTravelPlan} from '../site/jets_travel_context.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/jets_gameday_guide.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872983');
const now=Date.parse(snapshot.checkedAt)+1000;

test('exact Jets game receives bounded game-day guide claims in the public report',()=>{
  const selected=selectJetsGamedayGuide(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,5);
  const bundle=buildNflEvidenceBundle(game,{schedule,jetsGamedayGuide:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Jets–Browns club-published game-day guide/);
  assert.match(report,/MarissaAnn Rizzitello/);
  assert.match(report,/publication time.*not supplied/i);
  assert.match(report,/Jets access, rail and road source comparison/);
});

test('Jets guide does not transfer to another game or survive stale check',()=>{
  assert.equal(selectJetsGamedayGuide(schedule.games.find(item=>item.id!=='nfl:401872983'),snapshot,now).state,'outside_source_event');
  assert.equal(selectJetsGamedayGuide(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectJetsGamedayGuide(game,{...snapshot,sourceUrl:'https://example.com'},now).state,'stale_or_unavailable');
});

test('Jets travel comparison requires three current, exact-game publishers',()=>{
  const guide=selectJetsGamedayGuide(game,snapshot,now);
  const rail={state:'event-specific advisory listed',sourceUrl:'https://www.njtransit.com/travel-alerts-to',advisories:[{url:'https://www.njtransit.com/node/123'}]};
  const road={state:'exact game listed',sourceUrl:'https://www.511nj.org/RSS511Service/RSS511Service.svc/rest/rss/RSSAllNJActiveEvents',eventListings:[{description:'game'}],gameDateRoadCount:2};
  const aligned=compareJetsTravelPlan(game,guide,rail,road);
  assert.equal(aligned.state,'three_publishers_list_game_plan');
  assert.equal(aligned.roadDateCandidates,2);
  assert.match(aligned.interpretation,/not confirmation/);
  assert.equal(compareJetsTravelPlan(game,guide,{state:'regional rail advisory listed',advisories:[]},road).state,'incomplete_source_alignment');
});
