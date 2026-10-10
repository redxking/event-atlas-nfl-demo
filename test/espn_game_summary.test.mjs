import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSelectedGame,summarizeSelectedGame} from '../site/espn_game_summary.js';

const now=Date.parse('2026-10-10T02:00:00Z');
const game={id:'nfl:401872980',kickoff:'2026-10-09T00:15:00Z',teams:[{name:'Tampa Bay Buccaneers',role:'away'},{name:'Dallas Cowboys',role:'home'}],venue:{id:'3687'}};
const summary={header:{id:'401872980',competitions:[{date:game.kickoff,status:{type:{state:'post',completed:true,description:'Final'}},competitors:[{homeAway:'home',team:{displayName:'Dallas Cowboys'},score:'16'},{homeAway:'away',team:{displayName:'Tampa Bay Buccaneers'},score:'24'}]}]},gameInfo:{venue:{id:'3687'},attendance:92351},article:{id:501,gameId:'401872980',type:'Recap',headline:'Buccaneers at Cowboys recap',published:'2026-10-09T02:00:00Z',lastModified:'2026-10-09T03:00:00Z',story:'full article body must not be retained'}};

test('selected-game browser check retains only validated publisher event facts',()=>{
  const result=summarizeSelectedGame(game,summary,now);
  assert.equal(result.state,'checked');
  assert.equal(result.gameState.away.score,24);
  assert.equal(result.reportedAttendance,92351);
  assert.equal(result.article.type,'Recap');
  assert.ok(!JSON.stringify(result).includes('full article body'));
  assert.equal(summarizeSelectedGame(game,{...summary,gameInfo:{...summary.gameInfo,venue:{id:'other'}}},now).state,'identity_mismatch');
  assert.equal(summarizeSelectedGame(game,{...summary,header:{...summary.header,competitions:[{...summary.header.competitions[0],competitors:[{...summary.header.competitions[0].competitors[0],team:{displayName:'Other Team'}},summary.header.competitions[0].competitors[1]]}]}},now).state,'identity_mismatch');
});

test('reported attendance requires a completed source status',()=>{
  const scheduled={...summary,header:{...summary.header,competitions:[{...summary.header.competitions[0],status:{type:{state:'pre',completed:false,description:'Scheduled'}}}]}};
  const result=summarizeSelectedGame(game,scheduled,now);
  assert.equal(result.reportedAttendance,null);
  assert.equal(result.gameState,null);
});

test('browser fetch accepts a bounded completed summary and labels source failure',async()=>{
  const body=JSON.stringify(summary);
  const result=await fetchSelectedGame(game,{now,fetchImpl:async()=>({ok:true,headers:{get:()=>String(620000)},text:async()=>body})});
  assert.equal(result.state,'checked');
  const failure=await fetchSelectedGame(game,{now,fetchImpl:async()=>{throw Error('offline')}});
  assert.equal(failure.state,'source_failed');
  assert.equal(failure.gameState,null);
});
