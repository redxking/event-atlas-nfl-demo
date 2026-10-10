export const soundTransitSeahawksUrl='https://www.soundtransit.org/get-to-know-us/news-events/calendar/seahawks-vs-san-francisco-2026-10-11';
const ids={N:new Set(['1831','1833']),S:new Set(['1630','1632','1634'])};

export function selectSoundTransitSeahawks(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:soundTransitSeahawksUrl,arrivals:[]};
  if(game?.id!=='nfl:401872992'||game?.venue?.id!=='3673'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-11'))return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.sound-transit-seahawks.v1'||snapshot.status!=='ok'||snapshot.gameId!==game.id||snapshot.venueId!==game.venue.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceUrl!==soundTransitSeahawksUrl||snapshot.sourcePublicationTime!==null||!Number.isFinite(at)||at>now+60000||now-at>12*3600000||!Array.isArray(snapshot.arrivals)||snapshot.arrivals.length!==5||!Array.isArray(snapshot.northReturnMinutesAfterGameEnd)||JSON.stringify(snapshot.northReturnMinutesAfterGameEnd)!=='[20,45]'||JSON.stringify(snapshot.southReturnMinutesAfterGameEndApprox)!=='[10,20,45]'||snapshot.tLineExtraConnectingService!==true||!/^[a-f0-9]{64}$/.test(snapshot.sourceTextSha256||''))return {...empty,state:'stale_or_unavailable'};
  const arrivals=snapshot.arrivals.filter(item=>ids[item?.line]?.has(item.tripId)&&/^2026-10-11T\d{2}:\d{2}:00-07:00$/.test(item.seattleArrivalAt||'')&&Number.isFinite(Date.parse(item.seattleArrivalAt)));
  if(arrivals.length!==5||new Set(arrivals.map(item=>item.tripId)).size!==5)return {...empty,state:'stale_or_unavailable'};
  return {state:'current_published_service_plan',asOf:snapshot.checkedAt,sourceUrl:soundTransitSeahawksUrl,arrivals,northReturnMinutesAfterGameEnd:[20,45],southReturnMinutesAfterGameEndApprox:[10,20,45],tLineExtraConnectingService:true,sourceTextSha256:snapshot.sourceTextSha256,interpretation:snapshot.interpretation};
}

export function compareSounderToGates(game,guide,operator){
  if(game?.id!=='nfl:401872992'||game?.venue?.id!=='3673')return {state:'outside_source_event'};
  const gate=guide?.state==='current_published_plan'&&guide.claims?.some(item=>item.id==='gates_open')?'2026-10-11T11:30:00-07:00':null;
  if(!gate||operator?.state!=='current_published_service_plan')return {state:'incomplete_source_alignment',gateOpensAt:gate,arrivalsBeforeGate:null,arrivalsAfterGate:null,interpretation:'Current operator timetable or club gate plan is unavailable; do not infer an event access window.'};
  const gateAt=Date.parse(gate),before=operator.arrivals.filter(item=>Date.parse(item.seattleArrivalAt)<gateAt).length;
  return {state:'published_schedule_compared',gateOpensAt:gate,arrivalsBeforeGate:before,arrivalsAfterGate:operator.arrivals.length-before,interpretation:'Compares Sound Transit scheduled Seattle arrivals with the Seahawks published gate opening. King Street Station is not a stadium entrance; walking, queues, train operation, and gate status are unverified. This is not a crowd estimate or threat finding.'};
}
