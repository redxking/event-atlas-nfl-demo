export const septaServiceAlertsFeed='https://www3.septa.org/gtfsrt/septa-pa-us/Service/rtServiceAlerts.pb';
export const septaAlertsPage='https://www.septa.org/alerts/';
export const septaVenueId='3806';
const stationStops=new Set(['1281','32141']);
const windowMs=3600000;
const isoSeconds=value=>{const n=Number(String(value));return Number.isSafeInteger(n)&&n>0&&n<4102444800?new Date(n*1000).toISOString():null};
const clean=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';
const english=value=>clean(value?.translation?.find(item=>item.language==='en')?.text||value?.translation?.[0]?.text);

export function summarizeSeptaFeed(feed,retrievedAt=Date.now()){
  const entities=feed?.entity,sourceAt=isoSeconds(feed?.header?.timestamp);
  if(!Array.isArray(entities)||entities.length>2000||!sourceAt||!Number.isFinite(retrievedAt)||retrievedAt-Date.parse(sourceAt)>30*60000||Date.parse(sourceAt)-retrievedAt>60000)throw Error('SEPTA GTFS-RT feed is malformed or stale');
  const alerts=[];let invalidCount=0;
  for(const entity of entities){
    const selectors=entity?.alert?.informedEntity;
    if(!Array.isArray(selectors)||!selectors.some(item=>['B1','B2'].includes(item.routeId)||stationStops.has(String(item.stopId))))continue;
    const id=String(entity.id||'');
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!Array.isArray(entity.alert.activePeriod)||entity.alert.activePeriod.length>20){invalidCount++;continue}
    const periods=entity.alert.activePeriod.map(item=>({start:isoSeconds(item.start),end:item.end==null?null:isoSeconds(item.end)}));
    if(!periods.length||periods.some(item=>!item.start||item.end&&Date.parse(item.end)<Date.parse(item.start))){invalidCount++;continue}
    const stationSpecific=selectors.some(item=>stationStops.has(String(item.stopId)));
    alerts.push({id,scope:stationSpecific?'NRG station stop':'B Line route',header:english(entity.alert.headerText)||'SEPTA service alert',cause:clean(entity.alert.cause,60),effect:clean(entity.alert.effect,60),periods,sourceUrl:septaAlertsPage});
  }
  return {status:invalidCount||alerts.length>40?'partial':'ok',retrievedAt:new Date(retrievedAt).toISOString(),sourceAt,sourceUrl:septaServiceAlertsFeed,sourcePageUrl:septaAlertsPage,totalEntities:entities.length,matchingCount:alerts.length,invalidCount,alerts:alerts.slice(0,40)};
}

export function selectSeptaForGame(game,snapshot,now=Date.now()){
  if(game?.venue?.id!==septaVenueId)return null;
  const retrieved=Date.parse(snapshot?.retrievedAt),source=Date.parse(snapshot?.sourceAt);
  const current=['ok','partial'].includes(snapshot?.status)&&Number.isFinite(retrieved)&&Number.isFinite(source)&&retrieved<=now+60000&&source<=now+60000&&now-retrieved<=2*windowMs&&now-source<=2*windowMs&&Array.isArray(snapshot.alerts);
  if(!current)return {state:snapshot?.status==='error'?'source failed':'stale or unavailable',sourceUrl:septaAlertsPage,sourceAt:snapshot?.sourceAt||null,alerts:[],overlapCount:0,screenable:false};
  const kickoff=Date.parse(game.kickoff),screenable=!game.timeTbd&&Number.isFinite(kickoff)&&kickoff>=now-9*windowMs&&!/cancel/i.test(game.status||'');
  const start=kickoff-4*windowMs,end=kickoff+5*windowMs;
  const alerts=snapshot.alerts.slice(0,40).map(item=>({id:item.id,scope:item.scope,header:item.header,cause:item.cause,effect:item.effect,periods:item.periods,sourceUrl:item.sourceUrl,eventWindowOverlap:screenable&&item.periods.some(period=>Date.parse(period.start)<=end&&(period.end===null||Date.parse(period.end)>=start))}));
  return {state:snapshot.status==='partial'?'partial':'current snapshot',sourceUrl:septaAlertsPage,sourceAt:snapshot.sourceAt,retrievedAt:snapshot.retrievedAt,matchingCount:snapshot.matchingCount,invalidCount:snapshot.invalidCount,screenable,eventWindow:screenable?{start:new Date(start).toISOString(),end:new Date(end).toISOString()}:null,alerts,overlapCount:alerts.filter(item=>item.eventWindowOverlap).length,interpretation:'SEPTA B Line service alerts may affect travel to the South Philadelphia Sports Complex. A route-wide alert does not establish an NRG Station issue or stadium access impact.'};
}
