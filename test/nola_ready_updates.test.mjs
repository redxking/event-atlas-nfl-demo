import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectNolaReadyUpdates} from '../site/nola_ready_updates.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildPublishedReportState} from '../site/published_report_changes.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/nola_ready_updates.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Date.parse(snapshot.checkedAt)+1000;

test('Saints bundle, report and local model packet carry dated city updates',()=>{
  const context=selectNolaReadyUpdates(game,snapshot,now);
  assert.equal(context.state,'current_updates');
  assert.equal(context.entries.length,2);
  const bundle=buildNflEvidenceBundle(game,{schedule,nolaReadyUpdates:snapshot},now);
  assert.equal(bundle.publicObservations.nolaReadyDatedUpdates.entries[0].publishedAt,snapshot.entries[0].publishedAt);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/NOLA Ready dated city updates/);
  assert.match(report,/A title may concern a planned event or another area/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K9')?.sourceUrl,snapshot.entries[0].url);
});

test('a newer city RSS item enters the published change trail',()=>{
  const prior=buildPublishedReportState(buildNflEvidenceBundle(game,{schedule,nolaReadyUpdates:snapshot},now),game,null,null,now);
  const later=now+3600000;
  const item={title:'New city advisory',publishedAt:new Date(later-60000).toISOString(),url:'https://ready.nola.gov/incident/new-city-advisory/update-one/'};
  const revised={...snapshot,checkedAt:new Date(later-1000).toISOString(),entries:[item,...snapshot.entries]};
  const next=buildPublishedReportState(buildNflEvidenceBundle(game,{schedule,nolaReadyUpdates:revised},later),game,null,prior,later);
  assert.equal(next.changes.find(change=>change.kind==='city_update_published')?.sourceUrl,item.url);
  assert.equal(selectNolaReadyUpdates(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
});
