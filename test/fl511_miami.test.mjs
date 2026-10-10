import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeFl511Pages} from '../scripts/sync_fl511_miami.mjs';
import {selectFl511Miami} from '../site/fl511_miami.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildPublishedReportState} from '../site/published_report_changes.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/fl511_miami.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872982');
const now=Date.parse(snapshot.checkedAt)+1000;

test('FL511 list retains Miami-Dade display fields and rejects incomplete pages',()=>{
  const row={id:11,county:'Miami-Dade',type:'Closures',roadwayName:'US-441',direction:'Northbound',description:'Bridge up <b>near river</b>',severity:'Minor',startDate:'10/10/26, 6:02 AM',lastUpdated:'10/10/26, 6:03 AM',cameraIp:'192.0.2.1'};
  const page={recordsTotal:2,recordsFiltered:2,data:[row,{...row,id:12,county:'Duval'}]};
  const result=summarizeFl511Pages([page],new Date(now).toISOString());
  assert.equal(result.countyCount,1);
  assert.match(result.records[0].description,/Bridge up near river/);
  assert.ok(!JSON.stringify(result).includes('192.0.2.1'));
  assert.throws(()=>summarizeFl511Pages([{...page,data:[row]}],new Date(now).toISOString()),/pagination/);
});

test('Dolphins report and Qwen packet show county source without stadium claim',()=>{
  const context=selectFl511Miami(game,snapshot,now);
  assert.equal(context.state,'current_county_list');
  const bundle=buildNflEvidenceBundle(game,{schedule,fl511Miami:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Florida 511 Miami-Dade traffic list/);
  assert.match(report,/No row alone establishes current access impact or a threat/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='D2')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(selectFl511Miami(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
});

test('new county road listing creates a publisher review notice',()=>{
  const prior=buildPublishedReportState(buildNflEvidenceBundle(game,{schedule,fl511Miami:snapshot},now),game,null,null,now);
  const later=now+3600000;
  const item={...snapshot.records[0],id:999999,roadway:'Test road',description:'Synthetic road listing',lastUpdatedText:'10/10/26, 7:03 AM'};
  const revised={...snapshot,checkedAt:new Date(later-1000).toISOString(),countyCount:snapshot.countyCount+1,records:[...snapshot.records,item]};
  const next=buildPublishedReportState(buildNflEvidenceBundle(game,{schedule,fl511Miami:revised},later),game,null,prior,later);
  assert.equal(next.changes.find(change=>change.kind==='fl511_county_road_added')?.sourceUrl,snapshot.sourceUrl);
});
