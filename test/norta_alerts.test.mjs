import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectNortaAlerts,nortaAlertsUrl} from '../site/norta_alerts.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/norta_alerts.json',import.meta.url)));
const saints=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Date.parse(snapshot.retrievedAt)+1000;

test('RTA page stays a dated regional preview, not a stadium disruption claim',()=>{
  const selected=selectNortaAlerts(saints,snapshot,now);
  assert.equal(selected.state,'current_page_preview');
  assert.ok(selected.listedCount>=selected.recentCount);
  assert.ok(selected.recent.every(item=>item.sourceUrl===nortaAlertsUrl));
  const bundle=buildNflEvidenceBundle(saints,{schedule,nortaAlerts:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/New Orleans RTA public service-alert page/);
  assert.match(report,/A place-name match does not establish route geometry/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K4')?.sourceUrl,nortaAlertsUrl);
});

test('RTA stale, wrong-venue and mismatched-source snapshots fail closed',()=>{
  assert.equal(selectNortaAlerts(schedule.games.find(item=>item.venue.id!=='3493'),snapshot,now).state,'outside_venue');
  assert.equal(selectNortaAlerts(saints,snapshot,now+3*3600000).state,'stale_or_unavailable');
  assert.equal(selectNortaAlerts(saints,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
});

test('a changed notice with explicit area text enters the source-review change trail',()=>{
  const item={...snapshot.recent[0],routeId:'46',title:'Poydras notice',detail:'Poydras Street service notice',sourceTextSha256:'a'.repeat(64),sourceUrl:nortaAlertsUrl};
  const before={eventId:saints.id,venueId:'3493',sources:[],cues:[],nortaAlertContext:{state:'current_page_preview',asOf:new Date(now).toISOString(),sourceUrl:nortaAlertsUrl,venueTextCandidates:[]}};
  const after={...before,nortaAlertContext:{...before.nortaAlertContext,asOf:new Date(now+60000).toISOString(),venueTextCandidates:[item]}};
  const change=diffEventPicture(before,after,null,null,saints,saints).find(row=>row.kind==='transit_notice_matched');
  assert.equal(change?.sourceUrl,nortaAlertsUrl);
  assert.match(change.detail,/Confirm route geometry/);
});
