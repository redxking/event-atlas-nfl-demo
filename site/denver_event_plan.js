export const DENVER_EVENT_URL='https://www.empowerfieldatmilehigh.com/events/detail/26-broncos-vs-seahawks';
const clock='(?:1[0-2]|[1-9]):[0-5][0-9] [AP]M';
export function parseDenverEventPlan(html){
  if(typeof html!=='string'||html.length>1000000)throw Error('Invalid venue response');
  const body=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
  if(!body.includes('Denver Broncos vs Seattle Seahawks')||!body.includes('Week 6 Game Theme:')||! /October 15\s*, 2026/.test(body))throw Error('Exact game identity missing');
  const extract=label=>body.match(new RegExp(`${label}\\s+(${clock})`))?.[1];
  const eventStartsLocal=extract('Event Starts'),gatesOpenLocal=extract('Gates Open'),parkingOpenLocal=extract('Parking Lots Open'),doorsLocal=extract('Doors:');
  if(!eventStartsLocal||!gatesOpenLocal||!parkingOpenLocal||!doorsLocal)throw Error('Venue timing fields missing');
  return {eventStartsLocal,gatesOpenLocal,parkingOpenLocal,doorsLocal,doorTimingConflict:doorsLocal!==gatesOpenLocal,ballArenaParking:body.includes('Off-site parking at Ball Arena will not be available for this game.')?'listed_unavailable':'not_confirmed',publicationTime:null};
}

export function selectDenverEventPlan(game,snapshot,now=Date.now()){
  if(game?.id!=='nfl:401872995'||game?.venue?.id!=='3937')return {state:'outside_source_event'};
  const empty={state:'unavailable',sourceUrl:DENVER_EVENT_URL};
  const checked=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.denver-event-plan.v1'||snapshot.status!=='ok'||snapshot.gameId!==game.id||snapshot.sourceUrl!==DENVER_EVENT_URL||!Number.isFinite(checked)||checked>now+60000||now-checked>12*3600000||! /^[a-f0-9]{64}$/.test(snapshot.sourceTextSha256||'')||snapshot.publicationTime!==null)return empty;
  if(game.timeTbd||Date.parse(game.kickoff)!==Date.parse('2026-10-16T00:15Z')||/cancel|postpon|delay/i.test(game.status||''))return {...empty,state:'kickoff_unverified'};
  for(const key of ['eventStartsLocal','gatesOpenLocal','parkingOpenLocal','doorsLocal'])if(!new RegExp(`^${clock}$`).test(snapshot[key]||''))return empty;
  if(snapshot.doorTimingConflict!==(snapshot.doorsLocal!==snapshot.gatesOpenLocal)||!['listed_unavailable','not_confirmed'].includes(snapshot.ballArenaParking))return empty;
  return {state:'current_venue_plan',sourceUrl:DENVER_EVENT_URL,checkedAt:snapshot.checkedAt,eventStartsLocal:snapshot.eventStartsLocal,gatesOpenLocal:snapshot.gatesOpenLocal,parkingOpenLocal:snapshot.parkingOpenLocal,doorsLocal:snapshot.doorsLocal,doorTimingConflict:snapshot.doorTimingConflict,kickoffConflict:snapshot.eventStartsLocal!=='6:15 PM',ballArenaParking:snapshot.ballArenaParking,publicationTime:null,sourceTextSha256:snapshot.sourceTextSha256};
}
