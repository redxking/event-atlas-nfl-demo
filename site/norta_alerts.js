export const nortaAlertsUrl='https://www.norta.com/ride-with-us/service-alerts';
const locationTokens=/\b(?:Caesars Superdome|Superdome|Poydras|Loyola|Union Passenger Terminal)\b/i;
const validText=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;

export function selectNortaAlerts(game,snapshot,now=Date.now()){
  const empty={state:'outside_venue',asOf:null,sourceUrl:nortaAlertsUrl,listedCount:null,recentCount:null,recent:[],venueTextCandidates:[]};
  if(game?.venue?.id!=='3493')return empty;
  const at=Date.parse(snapshot?.retrievedAt);
  if(snapshot?.schema!=='event-atlas.norta-alert-page.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==nortaAlertsUrl||!Number.isFinite(at)||at>now+60000||now-at>2*3600000||!Number.isSafeInteger(snapshot.listedCount)||snapshot.listedCount<0||snapshot.listedCount>200||!Number.isSafeInteger(snapshot.recentCount)||snapshot.recentCount<0||snapshot.recentCount>snapshot.listedCount||!Array.isArray(snapshot.recent)||snapshot.recent.length>12)return {...empty,state:'stale_or_unavailable'};
  const recent=snapshot.recent.filter(item=>/^[A-Za-z0-9-]{1,8}$/.test(item?.routeId||'')&&validText(item.routeName,100)&&['bus','streetcar'].includes(item.mode)&&validText(item.title,100)&&validText(item.asOfText,40)&&/^\d{4}-\d{2}-\d{2}$/.test(item.asOfDate||'')&&validText(item.detail,360)&&item.sourceUrl===nortaAlertsUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'')&&Math.abs(Date.parse(item.asOfDate)-Date.parse(new Date(now).toISOString().slice(0,10)))<=4*86400000);
  if(recent.length!==snapshot.recent.length||snapshot.recentCount<recent.length)return {...empty,state:'stale_or_unavailable'};
  const venueTextCandidates=recent.filter(item=>locationTokens.test(`${item.title} ${item.detail}`));
  return {state:'current_page_preview',asOf:snapshot.retrievedAt,sourceUrl:nortaAlertsUrl,listedCount:snapshot.listedCount,recentCount:snapshot.recentCount,recent,venueTextCandidates,interpretation:snapshot.interpretation};
}
