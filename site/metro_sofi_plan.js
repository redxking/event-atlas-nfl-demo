export const METRO_SOFI_URL='https://www.metro.net/destinations/sofi-stadium/';
const HOUR=3600000;
const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&#8217;|&rsquo;/g,"'").replace(/\s+/g,' ').trim();

export function parseMetroSofiPlan(html,checkedAt=new Date().toISOString()){
  if(typeof html!=='string'||html.length>750000||!Number.isFinite(Date.parse(checkedAt)))throw Error('Invalid Metro SoFi response');
  const block=html.match(/Take the SoFi Stadium Express for Rams and Chargers Games[\s\S]{0,1800}?<\/ol>/i)?.[0];
  const content=plain(block);
  if(!/Board the SoFi Stadium Express at Bus Bay 8 at the LAX\/Metro Transit Center Station/i.test(content)||
     !/Buses run every 10 minutes or less, beginning 3 hours before kickoff/i.test(content)||
     !/Return service starts at the beginning of the 4th quarter, with buses running every 5 minutes for 90 minutes after the game/i.test(content))throw Error('Metro SoFi service plan changed or unavailable');
  return {status:'ok',checkedAt:new Date(checkedAt).toISOString(),sourceUrl:METRO_SOFI_URL,boarding:'Bus Bay 8, LAX/Metro Transit Center Station',outboundStartsHoursBeforeKickoff:3,outboundMaximumMinutesBetweenBuses:10,returnStarts:'beginning of fourth quarter',returnMaximumMinutesBetweenBuses:5,returnMinutesAfterGame:90};
}

export function selectMetroSofiPlan(game,snapshot,now=Date.now()){
  const home=game?.teams?.find(team=>team.role==='home')?.name;
  if(game?.venue?.id!=='7065'||!['Los Angeles Chargers','Los Angeles Rams'].includes(home))return {state:'outside_source_event'};
  const kickoff=Date.parse(game.kickoff),checked=Date.parse(snapshot?.checkedAt);
  if(snapshot?.status!=='ok'||snapshot.sourceUrl!==METRO_SOFI_URL||!Number.isFinite(checked)||checked>now+60000||now-checked>12*HOUR)return {state:'unavailable',sourceUrl:METRO_SOFI_URL};
  if(game.timeTbd||!Number.isFinite(kickoff)||/cancel|postpon|delay/i.test(game.status||''))return {state:'kickoff_unverified',checkedAt:snapshot.checkedAt,sourceUrl:METRO_SOFI_URL};
  return {state:'published_operator_plan',checkedAt:snapshot.checkedAt,sourceUrl:METRO_SOFI_URL,boarding:snapshot.boarding,outboundStartsHoursBeforeKickoff:snapshot.outboundStartsHoursBeforeKickoff,outboundMaximumMinutesBetweenBuses:snapshot.outboundMaximumMinutesBetweenBuses,illustrativeOutboundStart:new Date(kickoff-3*HOUR).toISOString(),returnStarts:snapshot.returnStarts,returnMaximumMinutesBetweenBuses:snapshot.returnMaximumMinutesBetweenBuses,returnMinutesAfterGame:snapshot.returnMinutesAfterGame};
}
