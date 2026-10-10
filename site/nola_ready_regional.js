export const nolaReadyRegionalUrl='https://ready.nola.gov/incident/the-city-of-new-orleans-has-granted-permits-to-fes/national-fried-chicken-festival-2026/';
const ids=new Set(['sunday_window','lakefront_location','traffic_advisory']);

export function selectNolaReadyRegional(game,snapshot,activeIndex,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:nolaReadyRegionalUrl,claims:[],kickoffWindowOverlap:false};
  if(game?.id!=='nfl:401872987'||game?.venue?.id!=='3493'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  if(activeIndex?.state!=='current_index'||!activeIndex.entries.some(item=>item.id==='the-city-of-new-orleans-has-granted-permits-to-fes'))return {...empty,state:'active_index_unverified'};
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.nola-ready-regional.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==nolaReadyRegionalUrl||snapshot.sourcePublicationText!=='Fri Oct 09 2026 8:34 AM'||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>3||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&typeof item.summary==='string'&&item.summary.length<=250&&item.sourceUrl===nolaReadyRegionalUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  const kickoff=Date.parse(game.kickoff);
  const kickoffWindowOverlap=claims.some(item=>item.id==='sunday_window')&&Number.isFinite(kickoff)&&kickoff>=Date.parse('2026-10-11T11:00:00-05:00')&&kickoff<Date.parse('2026-10-11T21:00:00-05:00');
  return {state:snapshot.status==='ok'&&claims.length===3?'current_regional_notice':'partial_regional_notice',asOf:snapshot.checkedAt,sourceUrl:nolaReadyRegionalUrl,sourcePublicationText:snapshot.sourcePublicationText,claims,kickoffWindowOverlap,interpretation:snapshot.interpretation};
}
