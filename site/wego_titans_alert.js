export const wegoTitansAlertsUrl='https://www.wegotransit.com/ride/alerts/';
export const wegoTitansServiceUrl='https://www.wegotransit.com/titans/';
const summary='Routes 14, 23, 41, and 56 will travel using Woodland St to S 5th St inbound and outbound from 10 a.m. until 4 p.m. Nissan Stadium Stop is Woodland & S 1st. No Service on N 1st or S 1st Street.';

export function selectWeGoTitansAlert(game,snapshot,now=Date.now()){
  const empty={state:'outside_exact_game_scope',asOf:null,sourceUrl:wegoTitansAlertsUrl,routeNumbers:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.id!=='nfl:401872984'||game?.venue?.id!=='3810'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const checkedAt=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.wego-titans-alert.v1'||snapshot.status!=='ok'||snapshot.gameId!==game.id||snapshot.venueId!=='3810'||snapshot.sourceUrl!==wegoTitansAlertsUrl||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>2*3600000||snapshot.sourceWindowText!=='Sun October 11, 2026 10:00 AM-Sun October 11, 2026 4:00 PM'||snapshot.startAt!=='2026-10-11T15:00:00Z'||snapshot.endAt!=='2026-10-11T21:00:00Z'||JSON.stringify(snapshot.routeNumbers)!==JSON.stringify(['14','23','41','56'])||snapshot.summary!==summary||!/^[a-f0-9]{64}$/.test(snapshot.sourceTextSha256||''))return {...empty,state:'stale_or_unavailable'};
  return {...empty,state:'current_operator_notice',asOf:snapshot.checkedAt,routeNumbers:snapshot.routeNumbers,startAt:snapshot.startAt,endAt:snapshot.endAt,summary:snapshot.summary,sourceTextSha256:snapshot.sourceTextSha256,interpretation:snapshot.interpretation};
}

export function selectWeGoTitansService(game,snapshot,now=Date.now()){
  const empty={state:'outside_exact_game_scope',asOf:null,sourceUrl:wegoTitansServiceUrl};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.id!=='nfl:401872984'||game?.venue?.id!=='3810'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const plan=snapshot?.servicePlan,checkedAt=Date.parse(plan?.checkedAt);
  if(snapshot?.schema!=='event-atlas.wego-titans-alert.v1'||snapshot.gameId!==game.id||snapshot.venueId!=='3810'||plan?.status!=='ok'||plan.sourceUrl!==wegoTitansServiceUrl||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>2*3600000||plan.gameDateText!=='October 11 vs. Houston Texans'||JSON.stringify(plan.localRouteNumbers)!==JSON.stringify(['4','14','23','41','56'])||plan.localFare!=='free on Titans home game days'||JSON.stringify(plan.expressPaidOrigins)!==JSON.stringify(['Cool Springs','Hendersonville','Gallatin'])||JSON.stringify(plan.expressFreeOrigins)!==JSON.stringify(['Hickory Hollow','Bellevue'])||plan.generalBusBoardingText!=='Nissan Stadium drop-off and pick-up for all buses is located on Woodland Street and South 1st Street near the Woodland Street bridge.'||plan.trainPlan!=='Lebanon to Riverfront with five additional stops; return from Riverfront one hour after the game ends'||!/^[a-f0-9]{64}$/.test(plan.sourceTextSha256||''))return {...empty,state:'stale_or_unavailable'};
  return {...empty,state:'current_operator_plan',asOf:plan.checkedAt,localRouteNumbers:plan.localRouteNumbers,localFare:plan.localFare,expressPaidOrigins:plan.expressPaidOrigins,expressFreeOrigins:plan.expressFreeOrigins,generalBusBoardingText:plan.generalBusBoardingText,trainPlan:plan.trainPlan,sourceTextSha256:plan.sourceTextSha256,interpretation:plan.interpretation};
}

export function compareNashvilleAccessPlans(game,ndot,wego){
  if(game?.id!=='nfl:401872984'||ndot?.state!=='current_published_plan'||wego?.state!=='current_operator_notice')return {state:'unavailable',windowOverlap:false};
  const start=Math.max(Date.parse(ndot.plannedStartAt),Date.parse(wego.startAt));
  const end=Math.min(Date.parse(ndot.plannedEndAt),Date.parse(wego.endAt));
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)return {state:'no_published_window_overlap',windowOverlap:false};
  return {state:'source_overlap_review',windowOverlap:true,overlapStartAt:new Date(start).toISOString(),overlapEndAt:new Date(end).toISOString(),commonStreetNames:['Woodland Street','S 1st Street'],ndotSourceUrl:ndot.sourceUrl,wegoSourceUrl:wego.sourceUrl,interpretation:'Two publisher plans mention Woodland and S 1st Streets during overlapping hours. Their operational relationship, actual closures, vehicle movement, and attendee effects are unverified.'};
}
