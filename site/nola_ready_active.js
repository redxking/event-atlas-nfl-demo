export const nolaReadyActiveUrl='https://ready.nola.gov/incident/';

export function selectNolaReadyActive(game,snapshot,now=Date.now()){
  const empty={state:'outside_near_term_city_scope',asOf:null,sourceUrl:nolaReadyActiveUrl,entries:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.venue?.id!=='3493'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.nola-ready-active.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==nolaReadyActiveUrl||!Number.isFinite(at)||at>now+60000||now-at>2*3600000||!Array.isArray(snapshot.entries)||snapshot.entries.length>20||!/^[a-f0-9]{64}$/.test(snapshot.listSha256||''))return {...empty,state:'stale_or_unavailable'};
  const entries=snapshot.entries.filter(item=>/^[a-z0-9_-]{3,120}$/.test(item?.id||'')&&typeof item.title==='string'&&item.title.length>=3&&item.title.length<=180&&item.url===`${nolaReadyActiveUrl}${item.id}/`);
  if(entries.length!==snapshot.entries.length||new Set(entries.map(item=>item.id)).size!==entries.length)return {...empty,state:'stale_or_unavailable'};
  return {state:'current_index',asOf:snapshot.checkedAt,sourceUrl:nolaReadyActiveUrl,entries,interpretation:snapshot.interpretation};
}
