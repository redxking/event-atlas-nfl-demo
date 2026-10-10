export const nolaReadyUpdatesUrl='https://ready.nola.gov/incident/?rss=NOLA-Ready-Updates';

export function selectNolaReadyUpdates(game,snapshot,now=Date.now()){
  const empty={state:'outside_near_term_city_scope',asOf:null,sourceUrl:nolaReadyUpdatesUrl,entries:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.venue?.id!=='3493'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const checkedAt=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.nola-ready-updates.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==nolaReadyUpdatesUrl||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>2*3600000||!Array.isArray(snapshot.entries)||snapshot.entries.length>20)return {...empty,state:'stale_or_unavailable'};
  const entries=snapshot.entries.filter(item=>{
    const at=Date.parse(item?.publishedAt);
    return typeof item.title==='string'&&item.title.length>=3&&item.title.length<=180&&/^https:\/\/ready\.nola\.gov\/incident\/[^/?#]+\/[^/?#]+\/$/.test(item.url||'')&&Number.isFinite(at)&&at<=checkedAt+5*60000&&checkedAt-at<=7*86400000;
  });
  if(entries.length!==snapshot.entries.length||new Set(entries.map(item=>item.url)).size!==entries.length)return {...empty,state:'stale_or_unavailable'};
  return {...empty,state:'current_updates',asOf:snapshot.checkedAt,entries,interpretation:snapshot.interpretation};
}
