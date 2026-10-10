import test from 'node:test';
import assert from 'node:assert/strict';
import {nflScoreboardState} from '../lib/nfl_scoreboard_state.mjs';

const competition={competitors:[{homeAway:'home',team:{displayName:'Green Bay Packers'},score:'17'},{homeAway:'away',team:{displayName:'Chicago Bears'},score:'20'}]};
const active={status:{type:{state:'in',completed:false},period:3,displayClock:'05:14'}};

test('publisher game state keeps validated live score and clock',()=>{
  assert.deepEqual(nflScoreboardState(active,competition),{phase:'in progress',home:{name:'Green Bay Packers',score:17},away:{name:'Chicago Bears',score:20},period:3,clock:'05:14'});
  assert.equal(nflScoreboardState({status:{type:{state:'pre'}}},competition),null);
  assert.equal(nflScoreboardState({status:{type:{state:'post',completed:false}}},competition),null);
  assert.equal(nflScoreboardState({status:{type:{state:'post',completed:true,name:'STATUS_CANCELED'}}},competition),null);
});

test('invalid score does not enter a game-state snapshot',()=>{
  assert.equal(nflScoreboardState(active,{competitors:[competition.competitors[0],{...competition.competitors[1],score:'20 OT'}]}),null);
  assert.deepEqual(nflScoreboardState({status:{type:{state:'post',completed:true}}},competition)?.period,null);
});
