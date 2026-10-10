export const falconsGamedayUrl='https://www.atlantafalcons.com/tickets/gameday';
const ids=new Set(['roof_plan','parking_open','gates_open','tailgate','tailgate_legends','backyard_legends','front_porch_legend','skybridge_legend','ring_of_honor']);

export function selectFalconsGameday(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:falconsGamedayUrl,claims:[]};
  if(game?.id!=='nfl:401872993'||game?.venue?.id!=='5348'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-12'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.falcons-gameday.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==falconsGamedayUrl||snapshot.sourcePublicationTime!==null||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>9||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&['operations','announced_person','announced_people'].includes(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=2&&item.sourceUrl===falconsGamedayUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===9?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:falconsGamedayUrl,claims,interpretation:snapshot.interpretation};
}
