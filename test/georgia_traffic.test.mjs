import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectGeorgiaTraffic} from '../site/georgia_traffic.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/georgia_traffic.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872993');
const now=Date.parse(snapshot.retrievedAt)+1000;
const recentRow={id:'gdot-9999999',category:'Crash',type:'crash',publisherStatus:'Confirmed',road:'I-20',crossRoad:'I-75',detail:'Publisher road description.',publisherDisplayedUpdated:'2026-10-10 04:14',publisherDisplayedStart:'2026-10-10 04:00',publisherDisplayedEnd:'2026-10-10 04:30',sourceUrl:snapshot.sourcePageUrl};
const withRecent={...snapshot,totalReturned:Math.max(snapshot.totalReturned,1),countyCount:1,recentCountyCount:1,olderOmittedCount:0,records:[recentRow]};

test('Fulton road table enters Falcons report as county context without a time overlap claim',()=>{
  const selected=selectGeorgiaTraffic(game,withRecent,now);
  assert.equal(selected.state,'current_retrieval_time_basis_unverified');
  assert.equal(selected.countyCount,1);
  assert.equal(selected.recentCountyCount,1);
  assert.equal(selected.olderOmittedCount,0);
  assert.ok(selected.records.every(item=>item.sourceUrl===snapshot.sourcePageUrl));
  const bundle=buildNflEvidenceBundle(game,{schedule,georgiaTraffic:withRecent},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Georgia DOT Fulton County traffic table/);
  assert.match(report,/time zone unverified/);
  assert.match(report,/does not compare them with kickoff/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='F6')?.kind,'county_road_table');
});

test('wrong game, stale source and revised county row stay source bounded',()=>{
  assert.equal(selectGeorgiaTraffic(schedule.games.find(item=>item.id!=='nfl:401872993'),snapshot,now).state,'outside_source_event');
  assert.equal(selectGeorgiaTraffic(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
  assert.equal(selectGeorgiaTraffic(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],georgiaTrafficContext:selectGeorgiaTraffic(game,withRecent,now)};
  const after={...before,georgiaTrafficContext:{...before.georgiaTrafficContext,asOf:new Date(now+3600000).toISOString(),records:before.georgiaTrafficContext.records.map(item=>({...item,detail:item.detail+' Updated.'}))}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='county_road_table_changed')?.sourceUrl,snapshot.sourcePageUrl);
});
