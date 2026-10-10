export const soundTransitAlertsFeed='https://s3.amazonaws.com/st-service-alerts-prod/alerts_pb.json';
export const soundTransitAlertsPage='https://www.soundtransit.org/ride-with-us/service-alerts';
export const soundTransitDataTerms='https://www.soundtransit.org/help-contacts/business-information/open-transit-data-otd/transit-data-terms-use';
const routeIds=new Set(['SNDR_EV','SNDR_TL']);
const hour=3600000;
const isoSeconds=value=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0&&n<4102444800?new Date(n*1000).toISOString():null};
const english=value=>value?.translation?.find(item=>item.language==='en')?.text??null;
const boundedText=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000e-\u001f]/.test(value)?value:null;

export function summarizeSoundTransitAlerts(feed,retrievedAt=Date.now()){
  const sourceAt=isoSeconds(feed?.header?.timestamp),entities=feed?.entity;
  if(feed?.header?.gtfs_realtime_version!=='2.0'||feed?.header?.incrementality!=='FULL_DATASET'||!Array.isArray(entities)||entities.length>500||!sourceAt||!Number.isFinite(retrievedAt)||retrievedAt-Date.parse(sourceAt)>30*60000||Date.parse(sourceAt)-retrievedAt>60000)throw Error('Sound Transit service-alert feed is malformed or stale');
  const alerts=[];let invalidCount=0;
  for(const entity of entities){
    const alert=entity?.alert,selectors=alert?.informed_entity;
    if(!Array.isArray(selectors)||!selectors.some(item=>item.agency_id==='40'&&item.route_type===2&&routeIds.has(item.route_id)))continue;
    const id=String(entity.id||''),header=boundedText(english(alert.header_text),350),periods=alert.active_period;
    const url=english(alert.url),linkedUrl=typeof url==='string'&&/^https:\/\/www\.soundtransit\.org\//.test(url)?url:soundTransitAlertsPage;
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!header||!Array.isArray(periods)||periods.length<1||periods.length>20){invalidCount++;continue}
    const activePeriods=periods.map(item=>({start:isoSeconds(item.start),end:item.end==null?null:isoSeconds(item.end)}));
    if(activePeriods.some(item=>!item.start||item.end&&Date.parse(item.end)<Date.parse(item.start))){invalidCount++;continue}
    const routes=[...new Set(selectors.filter(item=>item.agency_id==='40'&&item.route_type===2&&routeIds.has(item.route_id)).map(item=>item.route_id))].sort();
    alerts.push({id,header,routes,effect:boundedText(alert.effect,80)||'not supplied',cause:boundedText(alert.cause,80)||'not supplied',severity:boundedText(alert.severity_level,80)||'not supplied',activePeriods,sourceUrl:linkedUrl,eventNamed:/\bseahawks\b/i.test(header)&&linkedUrl.includes('/seahawks-vs-san-francisco-2026-10-11')});
  }
  return {schema:'event-atlas.sound-transit-alerts.v1',status:invalidCount||alerts.length>40?'partial':'ok',retrievedAt:new Date(retrievedAt).toISOString(),sourceAt,sourceUrl:soundTransitAlertsFeed,sourcePageUrl:soundTransitAlertsPage,termsUrl:soundTransitDataTerms,totalEntities:entities.length,matchingCount:alerts.length,invalidCount,alerts:alerts.slice(0,40)};
}

export function selectSoundTransitAlertsForGame(game,snapshot,now=Date.now()){
  if(game?.id!=='nfl:401872992'||game?.venue?.id!=='3673')return {state:'outside_source_event',alerts:[],overlapCount:0,sourceUrl:soundTransitAlertsPage};
  const retrieved=Date.parse(snapshot?.retrievedAt),source=Date.parse(snapshot?.sourceAt);
  if(snapshot?.schema!=='event-atlas.sound-transit-alerts.v1'||!['ok','partial'].includes(snapshot.status)||snapshot.sourceUrl!==soundTransitAlertsFeed||!Number.isFinite(retrieved)||!Number.isFinite(source)||retrieved>now+60000||source>now+60000||now-retrieved>2*hour||now-source>2*hour||!Array.isArray(snapshot.alerts)||snapshot.alerts.length>40)return {state:'stale_or_unavailable',alerts:[],overlapCount:0,sourceUrl:soundTransitAlertsPage,sourceAt:snapshot?.sourceAt||null};
  const kickoff=Date.parse(game.kickoff),screenable=!game.timeTbd&&Number.isFinite(kickoff)&&kickoff>=now-9*hour&&!/cancel/i.test(game.status||'');
  const start=kickoff-4*hour,end=kickoff+5*hour;
  const alerts=snapshot.alerts.filter(item=>/^[A-Za-z0-9_-]{1,80}$/.test(item.id||'')&&Array.isArray(item.routes)&&item.routes.some(route=>routeIds.has(route))&&boundedText(item.header,350)&&Array.isArray(item.activePeriods)).slice(0,40).map(item=>({...item,eventWindowOverlap:screenable&&item.activePeriods.some(period=>Number.isFinite(Date.parse(period.start))&&Date.parse(period.start)<=end&&(period.end===null||Date.parse(period.end)>=start))}));
  return {state:snapshot.status==='partial'?'partial':'current_snapshot',sourceUrl:soundTransitAlertsPage,feedUrl:soundTransitAlertsFeed,termsUrl:soundTransitDataTerms,sourceAt:snapshot.sourceAt,retrievedAt:snapshot.retrievedAt,screenable,alerts,overlapCount:alerts.filter(item=>item.eventWindowOverlap).length,interpretation:'Sound Transit rider alerts are operator notices. An extra-service alert is not a disruption; a route alert does not establish stadium access impact or a security threat. The operator says last-minute changes may be absent from its public alert page.'};
}
