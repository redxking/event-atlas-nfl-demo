export const chiefsGameCenterUrl='https://www.chiefs.com/game-day/2026/reg-week6/chargers-at-chiefs/';
const offsets={parking_open:-270,open_park:null,tailgate_suites:-270,ford_tailgate:-240,club_level:-150,stadium_gates:-120};

export function selectChiefsGameCenter(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:chiefsGameCenterUrl,claims:[]};
  if(game?.id!=='nfl:401873006'||game?.venue?.id!=='3622'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-18'))return empty;
  const at=Date.parse(snapshot?.checkedAt),kickoff=Date.parse(game.kickoff);
  if(snapshot?.schema!=='event-atlas.chiefs-game-center.v1'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-18'||snapshot.sourceUrl!==chiefsGameCenterUrl||snapshot.sourcePublicationTime!==null||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>6||!Number.isFinite(at)||at>now+60000||now-at>12*3600000||!Number.isFinite(kickoff))return {...empty,state:'stale_or_unavailable'};
  const claims=snapshot.claims.filter(item=>Object.hasOwn(offsets,item?.id)&&item.category==='club_operating_plan'&&item.openingOffsetMinutes===offsets[item.id]&&typeof item.summary==='string'&&item.summary.length<=250&&item.sourceUrl===chiefsGameCenterUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  if(claims.length!==snapshot.claims.length||new Set(claims.map(item=>item.id)).size!==claims.length)return {...empty,state:'stale_or_unavailable'};
  return {state:snapshot.status==='ok'&&claims.length===6?'current_published_plan':'partial_published_plan',asOf:snapshot.checkedAt,sourceUrl:chiefsGameCenterUrl,claims:claims.map(item=>({...item,plannedOpeningAt:item.openingOffsetMinutes===null?null:new Date(kickoff+item.openingOffsetMinutes*60000).toISOString()})),interpretation:snapshot.interpretation};
}
