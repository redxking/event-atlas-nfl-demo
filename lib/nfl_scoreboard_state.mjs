const score=value=>typeof value==='string'&&/^\d{1,3}$/.test(value)&&Number(value)<=200?Number(value):null;

export function nflScoreboardState(game,competition){
  const phase=game?.status?.type?.state;
  if(/cancel|postpon|delay/i.test(`${game?.status?.type?.name||''} ${game?.status?.type?.description||''}`))return null;
  if(phase!=='in'&&!(phase==='post'&&game?.status?.type?.completed===true))return null;
  const competitors=competition?.competitors;
  if(!Array.isArray(competitors)||competitors.length!==2)return null;
  const home=competitors.find(item=>item.homeAway==='home');
  const away=competitors.find(item=>item.homeAway==='away');
  const homeScore=score(home?.score),awayScore=score(away?.score);
  if(!home?.team?.displayName||!away?.team?.displayName||homeScore===null||awayScore===null)return null;
  const period=game.status.period;
  const clock=game.status.displayClock;
  return {phase:phase==='in'?'in progress':'final',home:{name:home.team.displayName,score:homeScore},away:{name:away.team.displayName,score:awayScore},period:phase==='in'&&Number.isInteger(period)&&period>=1&&period<=6?period:null,clock:phase==='in'&&typeof clock==='string'&&/^\d{1,2}:\d{2}$/.test(clock)?clock:null};
}
