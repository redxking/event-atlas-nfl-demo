const stationsUrl=/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3,4}\/\d+,\d+\/stations$/;
const stationId=/^[A-Z0-9]{3,6}$/;
const distanceKm=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((c-a)*r,(d-b)*r*Math.cos((a+c)*r/2))};
const metric=(value,unit,min,max)=>value?.unitCode===unit&&Number.isFinite(value.value)&&value.value>=min&&value.value<=max?Math.round(value.value*10)/10:null;
const unavailable=(checkedAt,reason)=>({state:'unavailable_or_stale',checkedAt,reason,sourceUrl:null});

export function selectNwsStationObservation(venue,stations,observations,checkedAt=Date.now()){
  const checked=new Date(checkedAt).toISOString();
  if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon)||!Array.isArray(stations?.features)||stations.features.length>100)return unavailable(checked,'Station inventory unavailable');
  const candidates=stations.features.map(feature=>{
    const id=feature?.properties?.stationIdentifier;
    const [lon,lat]=feature?.geometry?.coordinates||[];
    if(!stationId.test(id||'')||feature.id!==`https://api.weather.gov/stations/${id}`||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    const distance=distanceKm(venue.lat,venue.lon,lat,lon);
    return distance<=50?{id,name:String(feature.properties?.name||id).slice(0,120),distanceKm:Math.round(distance*10)/10}:null;
  }).filter(Boolean).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,3);
  for(const station of candidates){
    const raw=observations?.[station.id],p=raw?.properties||{},observed=Date.parse(p.timestamp);
    const observationUrl=raw?.id;
    if(typeof observationUrl!=='string'||!observationUrl.startsWith(`https://api.weather.gov/stations/${station.id}/observations/`)||!/^https:\/\/api\.weather\.gov\/stations\/[A-Z0-9]{3,6}\/observations\/[^/?#]+$/.test(observationUrl)||!Number.isFinite(observed)||observed>checkedAt+60000||checkedAt-observed>90*60000)continue;
    const text=typeof p.textDescription==='string'?p.textDescription.trim().slice(0,120):'';
    const temperatureC=metric(p.temperature,'wmoUnit:degC',-100,65);
    const windKmh=metric(p.windSpeed,'wmoUnit:km_h-1',0,350);
    const humidityPercent=metric(p.relativeHumidity,'wmoUnit:percent',0,100);
    if(!text&&temperatureC===null&&windKmh===null&&humidityPercent===null)continue;
    return {state:'current_station_observation',checkedAt:checked,observedAt:new Date(observed).toISOString(),stationId:station.id,stationName:station.name,distanceKm:station.distanceKm,description:text||null,temperatureC,windKmh,humidityPercent,sourceUrl:observationUrl,interpretation:'Observed at a nearby NWS station, not at the stadium. Station distance and report age limit venue relevance; no event impact or threat is inferred.'};
  }
  return unavailable(checked,candidates.length?'No current nearby station observation':'No listed station within 50 km');
}

export async function fetchNwsStationObservation(venue,{fetchImpl=fetch,headers={Accept:'application/geo+json'},now=Date.now()}={}){
  const checked=new Date(now).toISOString();
  if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon))return unavailable(checked,'Venue point unavailable');
  const get=async url=>{
    const response=await fetchImpl(url,{headers,signal:AbortSignal.timeout(12000)});
    if(!response.ok||Number(response.headers?.get?.('content-length'))>1000000)throw Error(`NWS HTTP ${response.status}`);
    const body=await response.text();
    if(body.length>1000000)throw Error('NWS response too large');
    return JSON.parse(body);
  };
  try{
    const point=await get(`https://api.weather.gov/points/${venue.lat},${venue.lon}`);
    const url=point?.properties?.observationStations;
    if(!stationsUrl.test(url||''))return unavailable(checked,'NWS station link unavailable');
    const stations=await get(url);
    if(!Array.isArray(stations?.features)||stations.features.length>100)return unavailable(checked,'Invalid station inventory');
    const nearest=stations.features.map(feature=>{
      const id=feature?.properties?.stationIdentifier,[lon,lat]=feature?.geometry?.coordinates||[];
      return stationId.test(id||'')&&feature.id===`https://api.weather.gov/stations/${id}`&&Number.isFinite(lat)&&Number.isFinite(lon)?{id,distance:distanceKm(venue.lat,venue.lon,lat,lon)}:null;
    }).filter(item=>item&&item.distance<=50).sort((a,b)=>a.distance-b.distance).slice(0,3);
    const values=await Promise.all(nearest.map(async item=>{try{return [item.id,await get(`https://api.weather.gov/stations/${item.id}/observations/latest`)]}catch{return [item.id,null]}}));
    return selectNwsStationObservation(venue,stations,Object.fromEntries(values),now);
  }catch{return unavailable(checked,'NWS observation source failed')}
}
