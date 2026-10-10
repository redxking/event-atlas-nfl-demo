import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectAnnouncedPeople} from '../site/announced_people.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const read=name=>JSON.parse(readFileSync(new URL(`../site/${name}`,import.meta.url)));
const schedule=read('nfl.json'),guide=read('seahawks_gameday.json');
const game=schedule.games.find(item=>item.id==='nfl:401872992');
const now=Date.parse(guide.checkedAt)+1000;

test('exact-game club announcements become linked people records without attendance claims',()=>{
  const bundle=buildNflEvidenceBundle(game,{schedule,seahawksGameday:guide},now);
  const people=bundle.publicObservations.clubAnnouncedPeople;
  assert.deepEqual(people.map(item=>item.name),['Mateo Lopez','Allen Stone']);
  assert.ok(people.every(item=>item.eventId===game.id&&item.venueId===game.venue.id&&item.attendanceStatus==='unverified'&&item.protectiveStatus==='not_assigned'&&item.sourceTextSha256.length===64));
  const report=buildNflPublicReport(bundle);
  assert.match(report,/## Club-announced people and roles/);
  assert.match(report,/Mateo Lopez/);
  assert.match(report,/Allen Stone/);
  assert.match(report,/not observed attendance/);
});

test('stale, failed-source and unapproved person claims cannot enter the public event record',()=>{
  const claim={id:'anthem',category:'announced_person',names:['Example Person'],summary:'Club announces an anthem performer.',sourceUrl:'https://www.seahawks.com/game-day/',sourceTextSha256:'a'.repeat(64)};
  const context={state:'current_published_plan',asOf:new Date(now).toISOString(),claims:[claim]};
  assert.equal(selectAnnouncedPeople(game,{seahawksGuideContext:context},now).length,1);
  assert.equal(selectAnnouncedPeople(game,{seahawksGuideContext:{...context,asOf:new Date(now-13*3600000).toISOString()}},now).length,0);
  assert.equal(selectAnnouncedPeople(game,{seahawksGuideContext:{...context,claims:[{...claim,sourceUrl:'https://unapproved.example/page'}]}},now).length,0);
  assert.equal(selectAnnouncedPeople({...game,id:'nfl:401872990',venue:{id:'3798'}},{packersReleaseContext:{...context,sources:[{sourceUrl:claim.sourceUrl,state:'failed'}]}},now).length,0);
  assert.equal(selectAnnouncedPeople({...game,id:'nfl:other'},{seahawksGuideContext:context},now).length,0);
});
