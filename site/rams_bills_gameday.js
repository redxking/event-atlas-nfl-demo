export const ramsBillsGamedayUrl='https://www.therams.com/news/know-before-you-go-rams-vs-buffalo-bills-at-sofi-stadium-week-5';
const ids=new Set(['pregame_performance','anthem','halftime','third_quarter','legend','military_hero','nonprofit_legend','early_entry','plaza_activities','registration_activation']);

export function selectRamsBillsGameday(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:ramsBillsGamedayUrl,claims:[]};
  if(game?.id!=='nfl:401872994'||game?.venue?.id!=='7065'||game.teams?.find(team=>team.role==='home')?.name!=='Los Angeles Rams'||game.teams?.find(team=>team.role==='away')?.name!=='Buffalo Bills'||game.timeTbd||!String(game.kickoff||'').startsWith('2026-10-13T00:15'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.rams-bills-gameday.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-12'||snapshot.sourceUrl!==ramsBillsGamedayUrl||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>10||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&['program','operations','announced_person'].includes(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=1&&item.sourceUrl===ramsBillsGamedayUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===10?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:ramsBillsGamedayUrl,sourcePublicationText:snapshot.sourcePublicationText,claims,interpretation:snapshot.interpretation};
}
