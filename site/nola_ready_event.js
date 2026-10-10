export const nolaReadyEventUrl='https://ready.nola.gov/incident/crescent-city-blues-bbq-festival-2026/crescent-city-blues-bbq-festival-2026/';
const ids=new Set(['sunday_window','cbd_location','traffic_advisory','camp_closure']);

export function selectNolaReadyEvent(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:nolaReadyEventUrl,claims:[],kickoffWindowOverlap:false};
  if(game?.id!=='nfl:401872987'||game?.venue?.id!=='3493'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.nola-ready-event.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==nolaReadyEventUrl||snapshot.sourcePublicationText!=='Fri Oct 09 2026 8:39 AM'||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>4||!Number.isFinite(at)||at>now+60000||now-at>12*3600000)return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&typeof item.summary==='string'&&item.summary.length<=250&&item.sourceUrl===nolaReadyEventUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  const kickoff=Date.parse(game.kickoff);
  const windowStart=Date.parse('2026-10-11T11:00:00-05:00');
  const windowEnd=Date.parse('2026-10-11T20:30:00-05:00');
  const kickoffWindowOverlap=claims.some(item=>item.id==='sunday_window')&&Number.isFinite(kickoff)&&kickoff>=windowStart&&kickoff<windowEnd;
  return {state:snapshot.status==='ok'&&claims.length===4?'current_city_notice':'partial_city_notice',asOf:snapshot.checkedAt,sourceUrl:nolaReadyEventUrl,sourcePublicationText:snapshot.sourcePublicationText,claims,kickoffWindowOverlap,interpretation:snapshot.interpretation};
}
