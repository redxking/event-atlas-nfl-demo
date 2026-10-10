export const nolaCallsDataset='https://data.nola.gov/Public-Safety-and-Preparedness/Calls-for-Service-2026/es9j-6y5d';
export const nolaCallsResource='https://data.nola.gov/resource/es9j-6y5d.json';
export const nolaCallsMetadata='https://data.nola.gov/api/views/es9j-6y5d.json';
const DAY=86400000;
const dayBefore=(now)=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(item=>[item.type,item.value]));
  const local=`${parts.year}-${parts.month}-${parts.day}`;
  return new Date(Date.parse(`${local}T00:00:00Z`)-DAY).toISOString().slice(0,10);
};

export function nolaCallQueries(venue,now=Date.now()){
  if(venue?.id!=='3493'||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||!Number.isFinite(now))throw Error('Superdome candidate point and current time required');
  const start=dayBefore(now),end=new Date(Date.parse(`${start}T00:00:00Z`)+DAY).toISOString().slice(0,10);
  const count=new URL(nolaCallsResource);
  count.search=new URLSearchParams({$select:'count(*) as count',$where:`within_circle(location, ${venue.lat}, ${venue.lon}, 2000) AND timecreate >= '${start}T00:00:00' AND timecreate < '${end}T00:00:00'`});
  const latest=new URL(nolaCallsResource);
  latest.search=new URLSearchParams({$select:'max(timecreate) as latest'});
  return {countUrl:count.href,latestUrl:latest.href,metadataUrl:nolaCallsMetadata,start,end,radiusKm:2};
}

export function summarizeNolaCalls(countResponse,latestResponse,metadata,query,checkedAt){
  const count=Number(countResponse?.[0]?.count),sourceLatestText=latestResponse?.[0]?.latest;
  const publisherUpdatedAt=Number(metadata?.rowsUpdatedAt)*1000;
  if(!Array.isArray(countResponse)||countResponse.length!==1||!Number.isSafeInteger(count)||count<0||count>100000||!Array.isArray(latestResponse)||latestResponse.length!==1||typeof sourceLatestText!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(sourceLatestText)||metadata?.id!=='es9j-6y5d'||!Number.isFinite(publisherUpdatedAt)||publisherUpdatedAt>checkedAt+60000||!/^\d{4}-\d{2}-\d{2}$/.test(query?.start)||!/^\d{4}-\d{2}-\d{2}$/.test(query?.end))throw Error('New Orleans count-only source response is incomplete');
  const sourceLatestDate=sourceLatestText.slice(0,10);
  const current=checkedAt-publisherUpdatedAt<=72*3600000&&sourceLatestDate>=query.start;
  return {state:current?'provisional_delayed_historical':'stale_source',nearbyCount:count,radiusKm:query.radiusKm,periodStart:query.start,periodEnd:query.end,sourceLatestText,publisherUpdatedAt:new Date(publisherUpdatedAt).toISOString(),checkedAt:new Date(checkedAt).toISOString()};
}

export function selectNolaCalls(game,snapshot,now=Date.now()){
  const empty={state:'outside_venue',asOf:null,sourceUrl:nolaCallsDataset,nearbyCount:null};
  if(game?.venue?.id!=='3493')return empty;
  const at=Date.parse(snapshot?.builtAt),updated=Date.parse(snapshot?.context?.publisherUpdatedAt);
  if(snapshot?.schema!=='event-atlas.nola-public-calls.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==nolaCallsDataset||snapshot.sourceId!=='nopd-opcd-calls-2026'||!Number.isFinite(at)||at>now+60000||now-at>12*3600000||!Number.isFinite(updated)||updated>now+60000||now-updated>72*3600000||snapshot.context?.state!=='provisional_delayed_historical'||!Number.isSafeInteger(snapshot.context.nearbyCount)||snapshot.context.nearbyCount<0||snapshot.context.nearbyCount>100000||snapshot.context.radiusKm!==2||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.context.periodStart||'')||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.context.periodEnd||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(snapshot.context.sourceLatestText||''))return {...empty,state:'stale_or_unavailable'};
  return {state:'provisional_delayed_historical',asOf:snapshot.builtAt,sourceUrl:nolaCallsDataset,nearbyCount:snapshot.context.nearbyCount,radiusKm:2,periodStart:snapshot.context.periodStart,periodEnd:snapshot.context.periodEnd,sourceLatestText:snapshot.context.sourceLatestText,publisherUpdatedAt:snapshot.context.publisherUpdatedAt,interpretation:snapshot.caution};
}
