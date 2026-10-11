export const packersGameReleaseUrls={
  event:'https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026',
  alumni:'https://www.packers.com/news/packers-welcoming-bubba-franks-ryan-longwell-as-featured-alumni-this-week-oct-8-2026'
};
const ids=new Set(['parking','fireworks','flyover','anthem','recognition','featured_alumni','franks_gameday','ruettgers_gameday','titletown_alumni']);
const categories=new Set(['operations','production','aviation','ceremony','announced_person','announced_people']);

export function selectPackersGameRelease(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sources:[],claims:[],interpretation:null};
  if(game?.id!=='nfl:401872990'||game?.venue?.id!=='3798'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.packers-game-release.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>9||!Array.isArray(snapshot.sources)||snapshot.sources.length!==2||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const sources=snapshot.sources.filter(item=>Object.hasOwn(packersGameReleaseUrls,item?.id)&&item.sourceUrl===packersGameReleaseUrls[item.id]&&['checked','failed'].includes(item.state)&&(item.publishedAt==null||(Number.isFinite(Date.parse(item.publishedAt))&&Date.parse(item.publishedAt)<=at+60000)));
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&categories.has(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=2&&item.names.every(name=>typeof name==='string'&&name.length<=80)&&Object.values(packersGameReleaseUrls).includes(item.sourceUrl)&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(sources.length!==2||new Set(sources.map(item=>item.id)).size!==2||claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  if(claims.some(claim=>!sources.some(source=>source.sourceUrl===claim.sourceUrl&&source.state==='checked')))return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===9?'current_published_announcements':'partial_published_announcements',asOf:snapshot.checkedAt,sources,claims,interpretation:snapshot.interpretation};
}
