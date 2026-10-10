import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectRamsBillsGameday} from '../site/rams_bills_gameday.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/rams_bills_gameday.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872994');
const now=Date.parse(snapshot.checkedAt)+1000;

test('Rams exact-game plans reach cited report and AI evidence without implying attendance',()=>{
  const selected=selectRamsBillsGameday(game,snapshot,now);
  assert.equal(selected.state,'current_published_plan');
  assert.equal(selected.claims.length,10);
  const bundle=buildNflEvidenceBundle(game,{schedule,ramsBillsGameday:snapshot},now);
  assert.deepEqual(bundle.publicObservations.clubAnnouncedPeople.map(item=>item.name),['Morgan St. Jean','JoJo','Timmy Trumpet','Darious Williams','Megan Harencak','Andrew Whitworth']);
  assert.ok(bundle.publicObservations.clubAnnouncedPeople.every(item=>item.attendanceStatus==='unverified'&&item.protectiveStatus==='not_assigned'));
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Rams–Bills exact-game club guide/);
  assert.match(report,/voter-registration booths/);
  assert.match(report,/not an election polling place/);
  assert.doesNotMatch(report,/Isabella Franco-Capps|Lexi Loya|Marcus Lechuga/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='T4')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='O2')?.sourceUrl,snapshot.sourceUrl);
});

test('exact-game identity, freshness, source and publisher revisions are bounded',()=>{
  assert.equal(selectRamsBillsGameday(schedule.games.find(item=>item.id!=='nfl:401872994'),snapshot,now).state,'outside_source_event');
  assert.equal(selectRamsBillsGameday({...game,kickoff:'2026-10-13T01:15Z'},snapshot,now).state,'outside_source_event');
  assert.equal(selectRamsBillsGameday(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectRamsBillsGameday(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const before={eventId:game.id,sources:[],cues:[],ramsBillsGuideContext:selectRamsBillsGameday(game,snapshot,now)};
  const after={...before,ramsBillsGuideContext:{...before.ramsBillsGuideContext,asOf:new Date(now+3600000).toISOString(),claims:before.ramsBillsGuideContext.claims.map(item=>item.id==='early_entry'?{...item,sourceTextSha256:'a'.repeat(64)}:item)}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='club_passage_revised')?.sourceUrl,snapshot.sourceUrl);
});
