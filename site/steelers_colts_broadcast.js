export const steelersColtsUrl='https://www.steelers.com/news/steelers-vs-colts-how-to-watch-listen-to-the-game-x5006';
const ids=new Set(['event_listing','tv_assignment','pregame_assignment','radio_assignment']);

export function selectSteelersColts(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:steelersColtsUrl,claims:[]};
  if(game?.id!=='nfl:401872985'||game?.venue?.id!=='3752'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt),published=Date.parse(snapshot?.publishedAt);
  if(snapshot?.schema!=='event-atlas.steelers-colts-broadcast.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==steelersColtsUrl||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>4||!Number.isFinite(at)||at>now+60000||now-at>12*3600000||!Number.isFinite(published)||published>at||published<Date.parse('2026-10-06T00:00:00Z'))return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&item.category==='official_event_context'&&typeof item.summary==='string'&&item.summary.length<=300&&item.sourceUrl===steelersColtsUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===4?'current_exact_game_article':'partial_exact_game_article',asOf:snapshot.checkedAt,publishedAt:snapshot.publishedAt,sourceUrl:steelersColtsUrl,claims,interpretation:snapshot.interpretation};
}
