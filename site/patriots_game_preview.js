export const patriotsPreviewUrl='https://www.patriots.com/news/game-preview-patriots-vs-raiders-nfl-week-5';
const ids=new Set(['throwback_uniforms','championship_team','vinatieri_halftime']);
const categories=new Set(['production','ceremony','announced_person']);

export function selectPatriotsGamePreview(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:patriotsPreviewUrl,publishedAt:null,claims:[]};
  if(game?.id!=='nfl:401872986'||game?.venue?.id!=='3738'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt),published=Date.parse(snapshot?.publishedAt);
  if(snapshot?.schema!=='event-atlas.patriots-game-preview.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==patriotsPreviewUrl||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>3||!Number.isFinite(at)||at>now+60000||now-at>12*3600000||!Number.isFinite(published)||published>at)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&categories.has(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=1&&item.names.every(name=>typeof name==='string'&&name.length<=80)&&item.sourceUrl===patriotsPreviewUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===3?'current_published_announcements':'partial_published_announcements',asOf:snapshot.checkedAt,sourceUrl:patriotsPreviewUrl,publishedAt:snapshot.publishedAt,claims,interpretation:snapshot.interpretation};
}
