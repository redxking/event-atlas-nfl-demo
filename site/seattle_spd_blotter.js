export const seattleSpdBlotterUrl='https://spdblotter.seattle.gov/feed/';

export function selectSeattleSpdBlotter(game,snapshot,now=Date.now()){
  const empty={state:'outside_near_term_city_scope',asOf:null,sourceBuildAt:null,sourceUrl:seattleSpdBlotterUrl,recent:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.venue?.id!=='3673'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const checked=Date.parse(snapshot?.checkedAt),built=Date.parse(snapshot?.sourceBuildAt);
  if(snapshot?.schema!=='event-atlas.seattle-spd-blotter.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==seattleSpdBlotterUrl||!Number.isFinite(checked)||checked>now+60000||now-checked>2*3600000||!Number.isFinite(built)||built>checked+5*60000||!Array.isArray(snapshot.recent)||snapshot.recent.length>10)return {...empty,state:'stale_or_unavailable'};
  const recent=snapshot.recent.filter(item=>{
    const at=Date.parse(item?.publishedAt);
    return typeof item.title==='string'&&item.title.length>=3&&item.title.length<=180&&/^https:\/\/spdblotter\.seattle\.gov\/20\d\d\/\d\d\/\d\d\/[a-z0-9-]+\/$/.test(item.url||'')&&Number.isFinite(at)&&at<=checked+5*60000&&checked-at<=7*86400000;
  });
  if(recent.length!==snapshot.recent.length||new Set(recent.map(item=>item.url)).size!==recent.length)return {...empty,state:'stale_or_unavailable'};
  return {...empty,state:'current_citywide_headlines',asOf:snapshot.checkedAt,sourceBuildAt:snapshot.sourceBuildAt,recent,interpretation:snapshot.interpretation};
}
