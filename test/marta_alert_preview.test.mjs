import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectMartaAlertPreview} from '../site/marta_alert_preview.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/marta_alert_preview.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872993');
const now=Date.parse(snapshot.retrievedAt)+1000;

test('MARTA homepage preview is source linked without treating an early expiry as game impact',()=>{
  const selected=selectMartaAlertPreview(game,snapshot,now);
  assert.equal(selected.state,'current_preview');
  assert.equal(selected.listedCount,1);
  assert.equal(selected.windowCandidateCount,0);
  assert.equal(selected.alerts[0].expiryExtendsIntoEventWindow,false);
  const bundle=buildNflEvidenceBundle(game,{schedule,martaAlertPreview:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/MARTA Train Alerts homepage preview/);
  assert.match(report,/expiry precedes the illustrative event window/);
  assert.match(report,/Zero visible items is not an all-clear/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.some(item=>item.id==='F5'),false);
});

test('a source-listed notice with future expiry enters review only, while stale and changed source fail closed',()=>{
  const candidate={...snapshot,alerts:[{...snapshot.alerts[0],id:'abcdef0123456789',detail:'Rail service notice for a route requiring operator review.',expiresAt:'2026-10-12T02:00:00Z',sourceTextSha256:'a'.repeat(64)}]};
  const selected=selectMartaAlertPreview(game,candidate,now);
  assert.equal(selected.windowCandidateCount,1);
  const bundle=buildNflEvidenceBundle(game,{schedule,martaAlertPreview:candidate},now);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='F5')?.kind,'operator_alert_preview');
  assert.equal(selectMartaAlertPreview(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
  assert.equal(selectMartaAlertPreview(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],martaAlertContext:selectMartaAlertPreview(game,snapshot,now)};
  const after={...before,martaAlertContext:{...selected,asOf:new Date(now+3600000).toISOString()}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='operator_alert_preview_changed')?.sourceUrl,snapshot.alertPageUrl);
});
