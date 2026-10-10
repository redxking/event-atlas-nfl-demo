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

const sourceUrl=game=>`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${String(game?.id||'').replace(/^nfl:/,'')}`;

export function selectGameArticleMetadata(game,summary,now=Date.now()){
  const id=String(game?.id||'').replace(/^nfl:/,'');
  const article=summary?.article;
  const type=article?.type;
  const published=Date.parse(article?.published),modified=Date.parse(article?.lastModified);
  const kickoff=Date.parse(game?.kickoff);
  if(!/^\d+$/.test(id)||!article||!/^\d+$/.test(String(article.id||''))||!['Preview','Recap'].includes(type)||String(article.gameId)!==id||typeof article.headline!=='string'||!article.headline.trim()||article.headline.length>300||!Number.isFinite(published)||!Number.isFinite(modified)||published>modified||modified>now+2*3600000||now-published>10*86400000||!Number.isFinite(kickoff)||published<kickoff-10*86400000||published>kickoff+2*86400000)return null;
  return {id:String(article.id),type,headline:article.headline.trim(),publishedAt:new Date(published).toISOString(),modifiedAt:new Date(modified).toISOString(),url:`https://www.espn.com/nfl/${type.toLowerCase()}?gameId=${id}`};
}

export function summarizeSelectedGame(game,summary,now=Date.now()){
  const url=sourceUrl(game),id=String(game?.id||'').replace(/^nfl:/,'');
  const competition=summary?.header?.competitions?.[0];
  const home=competition?.competitors?.find(item=>item.homeAway==='home')?.team?.displayName;
  const away=competition?.competitors?.find(item=>item.homeAway==='away')?.team?.displayName;
  if(!/^\d+$/.test(id)||String(summary?.header?.id)!==id||String(summary?.gameInfo?.venue?.id)!==String(game.venue?.id)||home!==game.teams?.find(item=>item.role==='home')?.name||away!==game.teams?.find(item=>item.role==='away')?.name)return {state:'identity_mismatch',checkedAt:new Date(now).toISOString(),sourceUrl:url,gameState:null,article:null};
  const status=competition?.status?.type;
  const reportedKickoff=Date.parse(competition?.date);
  const attendance=summary?.gameInfo?.attendance;
  return {state:'checked',checkedAt:new Date(now).toISOString(),sourceUrl:url,sourceStatus:typeof status?.description==='string'?status.description.slice(0,80):'not supplied',reportedKickoff:Number.isFinite(reportedKickoff)?new Date(reportedKickoff).toISOString():null,scheduleDiffers:Number.isFinite(reportedKickoff)&&reportedKickoff!==Date.parse(game.kickoff),gameState:nflScoreboardState({status:competition.status},competition),reportedAttendance:status?.state==='post'&&status?.completed===true&&Number.isSafeInteger(attendance)&&attendance>=0&&attendance<=200000?attendance:null,article:selectGameArticleMetadata(game,summary,now)};
}

export async function fetchSelectedGame(game,{fetchImpl=fetch,now=Date.now()}={}){
  const url=sourceUrl(game);
  try{
    const response=await fetchImpl(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000),cache:'no-store'});
    if(!response.ok||Number(response.headers?.get('content-length'))>1500000)throw Error(`HTTP ${response.status}`);
    const body=await response.text();
    if(body.length>1500000)throw Error('Response size limit');
    return summarizeSelectedGame(game,JSON.parse(body),now);
  }catch{return {state:'source_failed',checkedAt:new Date(now).toISOString(),sourceUrl:url,gameState:null,article:null}}
}
