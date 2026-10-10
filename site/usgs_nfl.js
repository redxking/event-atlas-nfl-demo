export const usgsSourceUrl='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
const HOUR=3600000;
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};
const eventUrl=value=>/^https:\/\/earthquake\.usgs\.gov\/earthquakes\/eventpage\/[A-Za-z0-9_-]+$/.test(value||'')?value:null;

export function selectUsgsForGame(game,conditions,now=Date.now(),monitoringMode='near_term_monitoring'){
  if(monitoringMode!=='near_term_monitoring')return {state:'not_started',asOf:null,sourceUrl:usgsSourceUrl,events:[]};
  const at=conditions?.at,feed=conditions?.quakes,features=feed?.features;
  if(conditions?.quakesError||feed?.type!=='FeatureCollection'||!Array.isArray(features)||features.length>10000||!Number.isFinite(at)||at>now+60000||now-at>5*60000)return {state:'stale_or_unavailable',asOf:null,sourceUrl:usgsSourceUrl,events:[]};
  const publisherAt=feed.metadata?.generated;
  if(publisherAt!==undefined&&(!Number.isFinite(publisherAt)||publisherAt>now+60000||now-publisherAt>HOUR))return {state:'stale_or_unavailable',asOf:null,sourceUrl:usgsSourceUrl,events:[]};
  const lat=game?.venue?.lat,lon=game?.venue?.lon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return {state:'not_screenable',asOf:new Date(at).toISOString(),sourceUrl:usgsSourceUrl,events:[]};
  const events=features.flatMap(feature=>{
    const p=feature?.properties,coordinates=feature?.geometry?.coordinates;
    if(feature?.geometry?.type!=='Point'||!Array.isArray(coordinates))return [];
    const [pointLon,pointLat]=coordinates,occurred=p?.time,sourceUrl=eventUrl(p?.url);
    if(typeof feature.id!=='string'||!sourceUrl||!Number.isFinite(pointLat)||!Number.isFinite(pointLon)||pointLat< -90||pointLat>90||pointLon< -180||pointLon>180||!Number.isFinite(occurred)||occurred>now+60000||now-occurred>7*24*HOUR||!Number.isFinite(p.mag)||p.mag<2.5)return [];
    const distanceKm=Math.round(distance(lat,lon,pointLat,pointLon)*10)/10;
    if(distanceKm>250)return [];
    return [{sourceId:feature.id,sourceUrl,title:String(p.title||'USGS earthquake').slice(0,240),magnitude:p.mag,occurredAt:new Date(occurred).toISOString(),updatedAt:Number.isFinite(p.updated)?new Date(p.updated).toISOString():null,distanceKm,point:[pointLon,pointLat]}];
  }).sort((a,b)=>a.distanceKm-b.distanceKm||Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,3);
  return {state:'current_snapshot',asOf:new Date(at).toISOString(),publisherAt:Number.isFinite(publisherAt)?new Date(publisherAt).toISOString():null,sourceUrl:usgsSourceUrl,events,interpretation:'Magnitude 2.5+ events in the bounded weekly USGS feed within 250 km of an unreviewed venue point. A nearby source point does not establish local shaking, damage, venue impact, or a threat.'};
}
