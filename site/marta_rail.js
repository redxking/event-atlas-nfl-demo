export const martaRailUrl='https://itsmarta.com/special-rail-schedules.aspx';
const ids=new Set(['gold_line','red_line','blue_line','green_line']);

export function selectMartaRail(game,snapshot,now=Date.now()){
  const empty={state:'outside_service_date',asOf:null,sourceUrl:martaRailUrl,claims:[]};
  if(game?.id!=='nfl:401872993'||game?.venue?.id!=='5348'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-12'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.marta-rail.v1'||snapshot.serviceDate!=='2026-10-11'||snapshot.sourceUrl!==martaRailUrl||snapshot.sourcePublicationTime!==null||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>4||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&item.category==='published_rail_frequency'&&typeof item.summary==='string'&&item.summary.length<=300&&typeof item.destination==='string'&&item.destination.length<=100&&item.sourceUrl===martaRailUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===4?'current_published_schedule':'partial_published_schedule',asOf:snapshot.checkedAt,sourceUrl:martaRailUrl,claims,interpretation:snapshot.interpretation};
}
