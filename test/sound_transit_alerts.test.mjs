import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeSoundTransitAlerts,selectSoundTransitAlertsForGame,soundTransitAlertsFeed} from '../site/sound_transit_alerts.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const read=name=>JSON.parse(readFileSync(new URL(`../site/${name}`,import.meta.url)));
const schedule=read('nfl.json'),snapshot=read('sound_transit_alerts.json');
const game=schedule.games.find(item=>item.id==='nfl:401872992');
const now=Date.parse(snapshot.retrievedAt)+1000;

test('official Sounder alerts retain exact operator text and classify extra service as a notice',()=>{
  const context=selectSoundTransitAlertsForGame(game,snapshot,now);
  assert.equal(context.state,'current_snapshot');
  assert.equal(context.alerts.length,3);
  assert.equal(context.alerts.filter(item=>item.eventNamed).length,1);
  assert.equal(context.alerts.find(item=>item.eventNamed).effect,'ADDITIONAL_SERVICE');
  assert.equal(context.alerts.find(item=>item.eventNamed).eventWindowOverlap,true);
  const bundle=buildNflEvidenceBundle(game,{schedule,soundTransitAlerts:snapshot},now);
  assert.equal(bundle.picture.cues.some(item=>item.sourceId==='sound-transit:20944'),false);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Sound Transit Sounder service alerts/);
  assert.match(report,/ADDITIONAL\\_SERVICE/);
  const brief={event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}};
  const packet=buildLocalAiPacket(brief,{now});
  assert.equal(packet.evidence.find(item=>item.id==='L1')?.sourceUrl,snapshot.alerts.find(item=>item.eventNamed).sourceUrl);
});

test('malformed and stale feed responses cannot become current event alerts',()=>{
  assert.throws(()=>summarizeSoundTransitAlerts({header:{gtfs_realtime_version:'2.0',incrementality:'FULL_DATASET',timestamp:1},entity:[]},now),/stale/);
  assert.equal(selectSoundTransitAlertsForGame(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
  assert.equal(selectSoundTransitAlertsForGame({...game,id:'nfl:other'},snapshot,now).state,'outside_source_event');
  const source={header:{gtfs_realtime_version:'2.0',incrementality:'FULL_DATASET',timestamp:Math.floor(now/1000)},entity:[{id:'bad',alert:{informed_entity:[{agency_id:'40',route_type:2,route_id:'SNDR_EV'}],header_text:{translation:[{language:'en',text:'Bad\u0000notice'}]},active_period:[{start:Math.floor(now/1000)}]}}]};
  assert.equal(summarizeSoundTransitAlerts(source,now).alerts.length,0);
  assert.equal(soundTransitAlertsFeed,snapshot.sourceUrl);
});

test('a newly added operator notice enters the change trail without a threat conclusion',()=>{
  const context=selectSoundTransitAlertsForGame(game,snapshot,now);
  const prior={eventId:game.id,sources:[],cues:[],sounderAlertsContext:{...context,sourceAt:'2026-10-10T06:00:00Z',alerts:context.alerts.filter(item=>!item.eventNamed)}};
  const next={...prior,sounderAlertsContext:{...context,sourceAt:'2026-10-10T07:00:00Z'}};
  const state={kickoff:game.kickoff,status:game.status,timeTbd:game.timeTbd};
  const changes=diffEventPicture(prior,next,null,null,state,state,'2026-10-10T07:00:01Z');
  assert.equal(changes.find(item=>item.kind==='operator_notice_added')?.sourceUrl,context.alerts.find(item=>item.eventNamed).sourceUrl);
  assert.match(changes.find(item=>item.kind==='operator_notice_added').detail,/does not establish/);
});
