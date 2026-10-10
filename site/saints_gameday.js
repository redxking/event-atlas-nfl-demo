export const saintsGamedayUrl='https://www.neworleanssaints.com/news/saints-vs-vikings-2026-nfl-week-5-gameday-guide';
const ids=new Set(['champions_square','stage_performance','anthem','ring_of_honor','legend_of_game']);

export function selectSaintsGameday(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:saintsGamedayUrl,claims:[]};
  if(game?.id!=='nfl:401872987'||game?.venue?.id!=='3493'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.saints-gameday.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==saintsGamedayUrl||snapshot.sourcePublicationText!=='Oct 09, 2026 at 10:01 AM'||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>5||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&['operations','production','announced_person'].includes(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=1&&item.sourceUrl===saintsGamedayUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===5?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:saintsGamedayUrl,sourcePublicationText:snapshot.sourcePublicationText,claims,interpretation:snapshot.interpretation};
}
