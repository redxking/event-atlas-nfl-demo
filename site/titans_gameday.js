export const titansGamedayUrl='https://www.tennesseetitans.com/stadium/gameday/';
const ids=new Set(['parking_open','ticket_office','tailgate_open','gates_open','alcohol_end','parking_close']);

export function selectTitansGameday(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:titansGamedayUrl,claims:[]};
  if(game?.id!=='nfl:401872984'||game?.venue?.id!=='3810'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.titans-gameday.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==titansGamedayUrl||snapshot.sourcePublicationTime!==null||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>6||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&item.category==='operations'&&typeof item.summary==='string'&&item.summary.length<=300&&item.sourceUrl===titansGamedayUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===6?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:titansGamedayUrl,claims,interpretation:snapshot.interpretation};
}
