export const seattleFireDataset='https://data.seattle.gov/Public-Safety/Seattle-Real-Time-Fire-911-Calls/kzjm-xkqj';
export const seattleFireMetadataUrl='https://data.seattle.gov/api/views/kzjm-xkqj';
export const seattleFireQueryBase='https://data.seattle.gov/resource/kzjm-xkqj.json';
const venue={id:'3673',lat:47.595277777,lon:-122.331666666};
const hour=3600000;
const localTime=ms=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(ms).map(item=>[item.type,item.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`};

export function seattleFireAggregateQuery(now=Date.now()){
  if(!Number.isFinite(now))throw Error('Valid query time required');
  const end=Math.floor(now/300000)*300000,start=end-2*hour;
  const url=new URL(seattleFireQueryBase);
  url.searchParams.set('$select','count(*) as nearby,max(datetime) as latest');
  url.searchParams.set('$where',`datetime between '${localTime(start)}' and '${localTime(end)}' and within_circle(report_location,${venue.lat},${venue.lon},5000)`);
  return {url:url.href,windowStartLocal:localTime(start),windowEndLocal:localTime(end)};
}

export function summarizeSeattleFireAggregate(rows,metadata,query,checkedAt=Date.now()){
  const count=Number(rows?.[0]?.nearby),updated=Number(metadata?.rowsUpdatedAt),latest=rows?.[0]?.latest;
  if(!Array.isArray(rows)||rows.length!==1||!Number.isSafeInteger(count)||count<0||count>10000||metadata?.id!=='kzjm-xkqj'||metadata?.name!=='Seattle Real Time Fire 911 Calls'||!Number.isSafeInteger(updated)||updated<=0||updated*1000>checkedAt+60000||checkedAt-updated*1000>30*60000||!/^202\d-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(query?.windowStartLocal||'')||!/^202\d-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(query?.windowEndLocal||'')||!query.url?.startsWith(seattleFireQueryBase+'?')||count>0&&!/^202\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/.test(latest||''))throw Error('Seattle Fire aggregate is malformed or source update is stale');
  return {schema:'event-atlas.seattle-fire-aggregate.v1',status:'ok',checkedAt:new Date(checkedAt).toISOString(),sourceUpdatedAt:new Date(updated*1000).toISOString(),sourceUrl:seattleFireDataset,queryUrl:query.url,venueId:venue.id,radiusKm:5,windowStartLocal:query.windowStartLocal,windowEndLocal:query.windowEndLocal,timeZone:'America/Los_Angeles',nearbyCount:count,latestDispatchLocal:count?latest:null,interpretation:'Two-hour rolling public fire dispatch count within 5 km of an unreviewed Lumen Field point. Source records may include medical and fire calls; this is not an active police alert, stadium incident, trend, threat finding, or complete emergency picture.'};
}

export function selectSeattleFireAggregate(game,snapshot,now=Date.now()){
  if(game?.venue?.id!==venue.id)return {state:'outside_source_area',sourceUrl:seattleFireDataset};
  const checked=Date.parse(snapshot?.checkedAt),updated=Date.parse(snapshot?.sourceUpdatedAt);
  if(snapshot?.schema!=='event-atlas.seattle-fire-aggregate.v1'||snapshot.status!=='ok'||snapshot.venueId!==venue.id||snapshot.sourceUrl!==seattleFireDataset||snapshot.radiusKm!==5||!Number.isSafeInteger(snapshot.nearbyCount)||snapshot.nearbyCount<0||!Number.isFinite(checked)||!Number.isFinite(updated)||checked>now+60000||updated>now+60000||now-checked>2*hour||now-updated>2*hour)return {state:'stale_or_unavailable',sourceUrl:seattleFireDataset};
  return {state:'recent_area_count',sourceUrl:seattleFireDataset,checkedAt:snapshot.checkedAt,sourceUpdatedAt:snapshot.sourceUpdatedAt,windowStartLocal:snapshot.windowStartLocal,windowEndLocal:snapshot.windowEndLocal,timeZone:snapshot.timeZone,radiusKm:5,nearbyCount:snapshot.nearbyCount,latestDispatchLocal:snapshot.latestDispatchLocal,interpretation:snapshot.interpretation};
}
