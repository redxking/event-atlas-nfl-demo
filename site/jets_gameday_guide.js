export const jetsGamedayGuideUrl='https://www.newyorkjets.com/fans/gameday-guide-2026';
const ids=new Set(['parking_pass','entry','anthem','tailgate','giveaway']);
const categories=new Set(['access','announced_person','production','promotion']);

export function selectJetsGamedayGuide(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:jetsGamedayGuideUrl,claims:[]};
  if(game?.id!=='nfl:401872983'||game?.venue?.id!=='3839'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.jets-gameday-guide.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==jetsGamedayGuideUrl||snapshot.sourcePublicationTime!==null||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>5||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&categories.has(item.category)&&typeof item.summary==='string'&&item.summary.length<=300&&Array.isArray(item.names)&&item.names.length<=1&&item.names.every(name=>typeof name==='string'&&name.length<=80)&&item.sourceUrl===jetsGamedayGuideUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===5?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:jetsGamedayGuideUrl,claims,interpretation:snapshot.interpretation};
}
