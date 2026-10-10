import test from 'node:test';
import assert from 'node:assert/strict';
import {compareClubAviation} from '../site/club_aviation_context.js';

const now=Date.parse('2026-10-10T06:00:00Z');
const game={id:'nfl:401872990',venue:{id:'3798'}};
const clubUrl='https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026';
const release={state:'current_published_announcements',asOf:'2026-10-10T05:50:00Z',claims:[{id:'flyover',sourceUrl:clubUrl}]};
const airspace={builtAt:'2026-10-10T05:30:00Z',sourceItemUrl:'https://faasysops.maps.arcgis.com/home/item.html?id=9f246af52c4049b99b50a2b97e2e5b2c',byGame:{[game.id]:{eventName:'Chicago Bears @ Green Bay Packers',venueName:'Lambeau Field',status:'SCHEDULED',startAt:'2026-10-11T16:00:00Z',endAt:'2026-10-11T21:00:00Z'}}};
const tfr={builtAt:'2026-10-10T05:45:00Z',sourcePageUrl:'https://tfr.faa.gov/tfr3/',byVenue:{}};

test('club plan and FAA SEAMS event record are compared without an authorization or flight finding',()=>{
  const result=compareClubAviation(game,release,airspace,tfr,now);
  assert.equal(result.state,'club_plan_and_faa_event_record');
  assert.equal(result.faaRecord.startAt,'2026-10-11T16:00:00Z');
  assert.equal(result.tfrSpatialCandidates,0);
  assert.match(result.summary,/do not confirm an aircraft flight, current NOTAM terms, authorization, or a drone detection/);
});

test('stale or mismatched FAA record leaves status unverified',()=>{
  const stale=compareClubAviation(game,release,{...airspace,builtAt:'2026-10-09T00:00:00Z'},tfr,now);
  assert.equal(stale.state,'club_plan_faa_status_unverified');
  const mismatched=compareClubAviation(game,release,{...airspace,byGame:{[game.id]:{...airspace.byGame[game.id],venueName:'Different venue'}}},tfr,now);
  assert.equal(mismatched.state,'club_plan_faa_status_unverified');
  assert.equal(compareClubAviation(game,{...release,state:'partial_published_announcements'},airspace,tfr,now).state,'no_current_exact_game_club_plan');
});
