export const nashvilleOemNewsUrl='https://www.nashville.gov/departments/emergency-management/news';

export function selectNashvilleOemNews(game,snapshot,now=Date.now()){
  const empty={state:'outside_near_term_city_scope',asOf:null,lastPublishedAt:null,sourceUrl:nashvilleOemNewsUrl,recent:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.venue?.id!=='3810'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const checkedAt=Date.parse(snapshot?.checkedAt),last=Date.parse(snapshot?.lastPublishedAt);
  if(snapshot?.schema!=='event-atlas.nashville-oem-news.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==nashvilleOemNewsUrl||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>2*3600000||!Number.isFinite(last)||last>checkedAt+5*60000||!Array.isArray(snapshot.recent)||snapshot.recent.length>20)return {...empty,state:'stale_or_unavailable'};
  const recent=snapshot.recent.filter(item=>{
    const at=Date.parse(item?.publishedAt);
    return typeof item.title==='string'&&item.title.length>=3&&item.title.length<=180&&/^https:\/\/www\.nashville\.gov\/departments\/emergency-management\/news\/[a-z0-9-]+$/.test(item.url||'')&&Number.isFinite(at)&&at<=checkedAt+5*60000&&checkedAt-at<=7*86400000;
  });
  if(recent.length!==snapshot.recent.length||new Set(recent.map(item=>item.url)).size!==recent.length)return {...empty,state:'stale_or_unavailable'};
  return {...empty,state:'current_newsroom_check',asOf:snapshot.checkedAt,lastPublishedAt:snapshot.lastPublishedAt,recent,interpretation:snapshot.interpretation};
}
