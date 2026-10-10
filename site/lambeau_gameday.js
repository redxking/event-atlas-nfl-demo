export const lambeauGamedayUrl='https://www.packers.com/lambeau-field/gameday-information';
const HOUR=3600000;
const ids=new Set(['gates','oneida','lombardi','postgame','bus','rideshare']);

export function selectLambeauGamedayForGame(game,snapshot,now=Date.now()){
  if(game?.venue?.id!=='3798')return {state:'outside_source_venue',asOf:null,sourceUrl:lambeauGamedayUrl,claims:[],derivedTimes:null};
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.lambeau-gameday.v1'||snapshot.sourceUrl!==lambeauGamedayUrl||!['ok','partial'].includes(snapshot.status)||!Array.isArray(snapshot.claims)||snapshot.claims.length>6||!Number.isFinite(at)||at>now+60000||now-at>12*HOUR)return {state:'stale_or_unavailable',asOf:null,sourceUrl:lambeauGamedayUrl,claims:[],derivedTimes:null};
  const claims=snapshot.claims.filter(item=>ids.has(item?.id)&&typeof item.topic==='string'&&item.topic.length<=60&&typeof item.summary==='string'&&item.summary.length<=350&&item.sourceUrl===lambeauGamedayUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''));
  const distinct=new Set(claims.map(item=>item.id)).size===claims.length;
  if(!distinct||claims.length!==snapshot.claims.length)return {state:'stale_or_unavailable',asOf:null,sourceUrl:lambeauGamedayUrl,claims:[],derivedTimes:null};
  const state=snapshot.status==='ok'&&claims.length===6?'current_published_plan':'partial_published_plan';
  const kickoff=Date.parse(game.kickoff),screenable=!game.timeTbd&&Number.isFinite(kickoff)&&!['cancelled in source','postponed in source'].includes(game.status);
  const has=id=>claims.some(item=>item.id===id);
  const derivedTimes=screenable?{basis:'Calculated from listed publisher kickoff and the general Packers home-game plan; confirm current venue and agency operations.',kickoff:game.kickoff,gatesOpenAt:has('gates')?new Date(kickoff-2*HOUR).toISOString():null,oneidaClosureStartAt:has('oneida')?new Date(kickoff-4*HOUR).toISOString():null,busServiceStartAt:has('bus')?new Date(kickoff-4*HOUR).toISOString():null}:null;
  return {state,asOf:snapshot.checkedAt,sourceUrl:lambeauGamedayUrl,claims,derivedTimes,interpretation:snapshot.interpretation};
}
