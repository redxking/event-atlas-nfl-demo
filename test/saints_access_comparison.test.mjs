import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectRoadContext} from '../site/road_relevance.js';
import {selectSaintsGameday} from '../site/saints_gameday.js';
import {compareSaintsAccessPlan} from '../site/saints_access_comparison.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const guide=JSON.parse(readFileSync(new URL('../site/saints_gameday.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Date.parse(guide.checkedAt)+1000;
const roadLayer='https://maps.dotd.la.gov/gdw/rest/services/Road_Closures/511_Road_Closures/FeatureServer/0';
const roads={builtAt:new Date(now-60_000).toISOString(),coverageFrom:'2026-10-10T00:00:00.000Z',coverageThrough:'2026-10-17T00:00:00.000Z',timedCoverageByVenue:{'3493':{from:'2026-10-10T00:00:00.000Z',through:'2026-10-17T00:00:00.000Z'}},sources:[{id:'ladotd-511-new-orleans',status:'ok',url:roadLayer}],byVenue:{'3493':[{id:'ladotd-511-97207',agency:'Louisiana DOTD 511',kind:'Agency-listed road event',name:'Published road window',detail:'Fixture road window for source comparison',distanceKm:2,startAt:'2026-10-11T12:30:00.000Z',endAt:'2026-10-11T18:00:00.000Z',sourceUrl:roadLayer}]}};

test('club pregame period and DOTD published road window become a two-source verification lead',()=>{
  const club=selectSaintsGameday(game,guide,now),road=selectRoadContext(game,roads,now);
  const comparison=compareSaintsAccessPlan(game,club,road);
  assert.equal(comparison.state,'review_candidates');
  assert.deepEqual(comparison.plannedWindow,{startAt:'2026-10-11T14:00:00.000Z',endAt:'2026-10-11T16:15:00.000Z'});
  assert.ok(comparison.matches.some(item=>item.id==='ladotd-511-97207'));
  const bundle=buildNflEvidenceBundle(game,{schedule,roads,saintsGameday:guide},now);
  const cue=bundle.picture.cues.find(item=>item.type==='access plan overlap');
  assert.ok(cue);
  assert.equal(cue.relatedSourceUrl,guide.sourceUrl);
  assert.equal(bundle.picture.cues.filter(item=>item.sourceId==='ladotd-511-97207').length,0);
  assert.equal(bundle.picture.reviewQueue.items.find(item=>item.domain==='pregame access')?.relatedSourceUrl,guide.sourceUrl);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Saints pregame and DOTD road-window comparison/);
  assert.match(report,/Saints club plan/);
  assert.match(report,/not proof of a route closure affecting attendees/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.kind==='review_cue'&&item.text.includes('Champions Square'))?.relatedSourceUrl,guide.sourceUrl);
});

test('stale roads, missing club claim and wrong game suppress the comparison',()=>{
  const club=selectSaintsGameday(game,guide,now),road=selectRoadContext(game,roads,now);
  assert.equal(compareSaintsAccessPlan(game,club,{...road,timingState:'stale'}).state,'unavailable');
  assert.equal(compareSaintsAccessPlan(game,{...club,claims:club.claims.filter(item=>item.id!=='champions_square')},road).state,'unavailable');
  assert.equal(compareSaintsAccessPlan(schedule.games.find(item=>item.id!=='nfl:401872987'),club,road).state,'unavailable');
  const noRoad={...road,records:road.records.map(item=>({...item,startAt:'2026-10-12T00:00:00Z',endAt:'2026-10-12T01:00:00Z'}))};
  assert.equal(compareSaintsAccessPlan(game,club,noRoad).state,'no_bounded_window_overlap');
});

test('record-specific DOTD EventID source URLs survive the hourly road refresh',()=>{
  const club=selectSaintsGameday(game,guide,now),road=selectRoadContext(game,roads,now);
  const matching=road.records.find(item=>item.id==='ladotd-511-97207');
  const url=new URL(matching.sourceUrl.replace(/\/$/,'')+'/query');
  url.search=new URLSearchParams({where:'EventID=97207',outFields:'EventID,RoadName',returnGeometry:'false',f:'pjson'});
  const refreshed={...road,records:road.records.map(item=>item.id===matching.id?{...item,sourceUrl:url.href}:item)};
  assert.equal(compareSaintsAccessPlan(game,club,refreshed).matches.find(item=>item.id===matching.id)?.sourceUrl,url.href);
  url.searchParams.set('where','EventID=97208');
  assert.equal(compareSaintsAccessPlan(game,club,{...road,records:[{...matching,sourceUrl:url.href}]}).matches.length,0);
});
