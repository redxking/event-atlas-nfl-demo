export function nflSourceStatus(type){
  if(/cancel|postpon|delay/i.test(`${type?.name||''} ${type?.description||''}`))return `source status ${String(type?.description||type?.name||'unknown').slice(0,80)}`;
  if(type?.state==='post'&&type.completed===true)return 'completed in source';
  if(type?.state==='in'&&type.completed===false)return 'in progress in source';
  if(type?.state==='pre'&&type.completed===false)return 'scheduled in source; unreviewed';
  return `source status ${String(type?.description||type?.name||'unknown').slice(0,80)}`;
}

export function includePublishedNflReport(game,now=Date.now()){
  const kickoff=Date.parse(game?.kickoff),age=now-kickoff;
  if(game?.timeTbd||!Number.isFinite(kickoff))return false;
  if(game.status==='scheduled in source; unreviewed')return age>=-14*86400000&&age<=6*3600000;
  if(game.status==='in progress in source')return age>=-6*3600000&&age<=18*3600000;
  if(game.status==='completed in source')return age>=0&&age<=24*3600000;
  return false;
}

export function publishedNflReportMode(game,now=Date.now()){
  if(includePublishedNflReport(game,now))return 'near_term_monitoring';
  const kickoff=Date.parse(game?.kickoff);
  if(game?.status==='scheduled in source; unreviewed'&&Number.isFinite(kickoff)&&kickoff>now)return 'season_planning';
  return null;
}
