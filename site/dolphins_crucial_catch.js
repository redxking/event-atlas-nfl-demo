export const dolphinsCrucialCatchUrl='https://www.miamidolphins.com/news/dolphins-cancer-challenge-celebrates-100-million-lifetime-raised-at-crucial-catch-game';
const ids=new Set(['crucial_catch_theme','fan_zone_mural','survivor_recognition','halftime_recognition','nimer_game_ball','almeida_recognition']);

export function selectDolphinsCrucialCatch(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:dolphinsCrucialCatchUrl,publishedAt:null,claims:[]};
  if(game?.id!=='nfl:401872982'||game?.venue?.id!=='3948'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt),published=Date.parse(snapshot?.publishedAt);
  if(snapshot?.schema!=='event-atlas.dolphins-crucial-catch.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==dolphinsCrucialCatchUrl||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>6||!Number.isFinite(at)||at>now+60000||now-at>12*3600000||!Number.isFinite(published)||published>at+60000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&['production','operations','announced_person'].includes(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=1&&item.sourceUrl===dolphinsCrucialCatchUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'')&&(!item.names.length||item.id==='nimer_game_ball'&&item.names[0]==='Stephen Nimer'||item.id==='almeida_recognition'&&item.names[0]==='Nicole Almeida'));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===6?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:dolphinsCrucialCatchUrl,publishedAt:new Date(published).toISOString(),claims,interpretation:snapshot.interpretation};
}
