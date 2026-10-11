export const nifcLayer='https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0';
export const nifcSource='https://data-nifc.opendata.arcgis.com/maps/nifc::current-wildland-fire-incident-locations';
const DAY=86400000,HOUR=3600000;
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((c-a)*r,(d-b)*r*Math.cos((a+c)*r/2))};
const iso=value=>Number.isFinite(value)?new Date(value).toISOString():null;
export function buildNifcSnapshot(raw,games,now=Date.now()){
  if(!Array.isArray(raw?.features)||raw.features.length>2000||raw.exceededTransferLimit||!Array.isArray(games))throw Error('Incomplete or invalid NIFC response');
  const points=[];
  for(const feature of raw.features){
    const p=feature?.attributes||{},g=feature?.geometry||{},updated=p.ModifiedOnDateTime_dt,discovered=p.FireDiscoveryDateTime;
    if(p.IncidentTypeCategory!=='WF'||!Number.isInteger(p.OBJECTID)||!Number.isFinite(g.x)||!Number.isFinite(g.y)||g.x< -180||g.x>180||g.y< -90||g.y>90||!Number.isFinite(updated)||updated>now+HOUR||now-updated>3*DAY||p.FireOutDateTime!=null)continue;
    points.push({id:p.OBJECTID,name:String(p.IncidentName||'Unnamed wildfire').slice(0,90),lat:g.y,lon:g.x,updatedAt:iso(updated),discoveredAt:iso(discovered),acres:Number.isFinite(p.IncidentSize)?Math.round(p.IncidentSize*10)/10:null,containedPercent:Number.isFinite(p.PercentContained)?p.PercentContained:null,sourceUrl:`${nifcLayer}/${p.OBJECTID}`});
  }
  const venues=new Map(games.map(game=>[game.venue?.id,game.venue]).filter(([id,v])=>id&&Number.isFinite(v?.lat)&&Number.isFinite(v?.lon)));
  const byVenue={};
  for(const [id,venue] of venues){
    const matches=points.map(p=>({...p,distanceKm:Math.round(distance(venue.lat,venue.lon,p.lat,p.lon)*10)/10})).filter(p=>p.distanceKm<=150).sort((a,b)=>a.distanceKm-b.distanceKm||Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0,5);
    if(matches.length)byVenue[id]=matches;
  }
  return {schema:'event-atlas.nifc-wildfire.v1',status:'ok',builtAt:iso(now),sourceUrl:nifcSource,sourceLayer:nifcLayer,sourceFeatureCount:raw.features.length,recentPointCount:points.length,byVenue,interpretation:'NIFC WFIGS public wildfire incident points updated within three days and within 150 km of a venue candidate point. Point distance is not perimeter distance, smoke exposure, road impact, or stadium impact. The source has its own fall-off rules and may omit incidents.'};
}
export function selectNifcForGame(game,snapshot,now=Date.now(),mode='near_term_monitoring'){
  if(mode!=='near_term_monitoring')return {state:'not_started',asOf:null,sourceUrl:nifcSource,events:[]};
  const at=Date.parse(snapshot?.builtAt);
  if(snapshot?.schema!=='event-atlas.nifc-wildfire.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==nifcSource||!Number.isFinite(at)||at>now+60000||now-at>12*HOUR)return {state:'stale_or_unavailable',asOf:null,sourceUrl:nifcSource,events:[]};
  const venueMap=snapshot.byVenue;
  if(!venueMap||typeof venueMap!=='object'||Array.isArray(venueMap))return {state:'stale_or_unavailable',asOf:null,sourceUrl:nifcSource,events:[]};
  const records=Object.hasOwn(venueMap,game?.venue?.id)?venueMap[game.venue.id]:[];
  if(!Array.isArray(records)||records.length>5)return {state:'stale_or_unavailable',asOf:null,sourceUrl:nifcSource,events:[]};
  const events=records.filter(p=>Number.isInteger(p?.id)&&p.sourceUrl===`${nifcLayer}/${p.id}`&&Number.isFinite(p.distanceKm)&&p.distanceKm>=0&&p.distanceKm<=150&&Date.parse(p.updatedAt)<=now+HOUR&&now-Date.parse(p.updatedAt)<=3*DAY).slice(0,5);
  if(events.length!==records.length)return {state:'stale_or_unavailable',asOf:null,sourceUrl:nifcSource,events:[]};
  return {state:'current_snapshot',asOf:snapshot.builtAt,sourceUrl:nifcSource,events,interpretation:snapshot.interpretation};
}
