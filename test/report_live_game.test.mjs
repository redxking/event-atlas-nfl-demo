import test from 'node:test';
import assert from 'node:assert/strict';
import {directGameEligible,directGameRecord} from '../site/report_live_game.js';
import {summarizeSelectedGame} from '../site/espn_game_summary.js';

const now=Date.parse('2026-10-10T12:00:00Z');
const context={monitoringMode:'near_term_monitoring',gameId:'nfl:401872984',venueId:'3810',home:'Tennessee Titans',away:'Houston Texans',kickoff:'2026-10-11T17:00:00Z'};

test('direct exact-game check is limited to a supported report and event window',()=>{
  assert.equal(directGameEligible(context,now),true);
  assert.equal(directGameEligible({...context,monitoringMode:'season_planning'},now),false);
  assert.equal(directGameEligible({...context,gameId:'nfl:invalid'},now),false);
  assert.equal(directGameEligible({...context,venueId:''},now),false);
  assert.equal(directGameEligible({...context,home:''},now),false);
  assert.equal(directGameEligible({...context,kickoff:'2026-11-11T17:00:00Z'},now),false);
  assert.equal(directGameEligible(context,Date.parse('2026-10-13T17:00:00Z')),false);
});

test('published report context preserves the exact ESPN identity contract',()=>{
  const game=directGameRecord(context);
  assert.deepEqual(game,{id:'nfl:401872984',kickoff:context.kickoff,venue:{id:'3810'},teams:[{role:'home',name:'Tennessee Titans'},{role:'away',name:'Houston Texans'}]});
  const summary={header:{id:'401872984',competitions:[{date:context.kickoff,status:{type:{description:'Scheduled',state:'pre'}},competitors:[{homeAway:'home',team:{displayName:'Tennessee Titans'}},{homeAway:'away',team:{displayName:'Houston Texans'}}]}]},gameInfo:{venue:{id:'3810'}}};
  assert.equal(summarizeSelectedGame(game,summary,now).state,'checked');
  assert.equal(summarizeSelectedGame(game,{...summary,gameInfo:{venue:{id:'9999'}}},now).state,'identity_mismatch');
});
