import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectNolaReadyActive} from '../site/nola_ready_active.js';
import {selectNolaReadyRegional} from '../site/nola_ready_regional.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {buildPublishedReportState} from '../site/published_report_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const active=JSON.parse(readFileSync(new URL('../site/nola_ready_active.json',import.meta.url)));
const regional=JSON.parse(readFileSync(new URL('../site/nola_ready_regional.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Math.max(Date.parse(active.checkedAt),Date.parse(regional.checkedAt))+1000;

test('Lakefront city festival is bounded regional context in the Saints report and model packet',()=>{
  const index=selectNolaReadyActive(game,active,now);
  const selected=selectNolaReadyRegional(game,regional,index,now);
  assert.equal(selected.state,'current_regional_notice');
  assert.equal(selected.kickoffWindowOverlap,true);
  const bundle=buildNflEvidenceBundle(game,{schedule,nolaReadyActive:active,nolaReadyRegional:regional},now);
  assert.equal(bundle.picture.sources.find(item=>item.name==='NOLA Ready Lakefront festival')?.state,'current_regional_notice');
  assert.equal(bundle.picture.cues.some(item=>item.type==='regional city event'),false);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Lakefront and Gentilly area/);
  assert.match(report,/Shared city and time do not establish a Superdome route effect/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K8')?.sourceUrl,regional.sourceUrl);
});

test('regional detail requires a current active listing and exact page identity',()=>{
  const index=selectNolaReadyActive(game,active,now);
  assert.equal(selectNolaReadyRegional(game,regional,{...index,entries:[]},now).state,'active_index_unverified');
  assert.equal(selectNolaReadyRegional(game,{...regional,sourceUrl:'https://example.com/'},index,now).state,'stale_or_unavailable');
  assert.equal(selectNolaReadyRegional(game,regional,selectNolaReadyActive(game,active,now+13*3600000),now+13*3600000).state,'active_index_unverified');
});

test('regional passage changes enter the published change history',()=>{
  const beforeBundle=buildNflEvidenceBundle(game,{schedule,nolaReadyActive:active,nolaReadyRegional:regional},now);
  const prior=buildPublishedReportState(beforeBundle,game,null,null,now);
  const later=now+3600000;
  const activeLater={...active,checkedAt:new Date(later-1000).toISOString()};
  const regionalLater={...regional,checkedAt:new Date(later-1000).toISOString(),claims:regional.claims.map(item=>item.id==='traffic_advisory'?{...item,sourceTextSha256:'c'.repeat(64)}:item)};
  const afterBundle=buildNflEvidenceBundle(game,{schedule,nolaReadyActive:activeLater,nolaReadyRegional:regionalLater},later);
  const next=buildPublishedReportState(afterBundle,game,null,prior,later);
  assert.equal(next.changes.find(item=>item.kind==='city_regional_notice_revised')?.sourceUrl,regional.sourceUrl);
});
