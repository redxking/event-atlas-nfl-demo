export const commandersGamedayUrl='https://www.commanders.com/matchups/giants';
const ids=new Set(['rideshare_open','parking_open','plaza_open','gates_open','plaza_band','color_guard','anthem','halftime','legend']);

export function selectCommandersGameday(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:commandersGamedayUrl,claims:[]};
  if(game?.id!=='nfl:401872988'||game?.venue?.id!=='3719'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.commanders-gameday.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==commandersGamedayUrl||snapshot.sourcePublicationTime!==null||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>9||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&['operations','program','announced_person'].includes(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=1&&item.sourceUrl===commandersGamedayUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===9?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:commandersGamedayUrl,claims,interpretation:snapshot.interpretation};
}
