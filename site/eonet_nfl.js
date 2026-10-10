export const eonetSourceUrl='https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&limit=500';
const HOUR=3600000;
const time=value=>Date.parse(value);
const km=(lat1,lon1,lat2,lon2)=>{const r=Math.PI/180;return 6371*Math.hypot((lat2-lat1)*r,(lon2-lon1)*r*Math.cos((lat1+lat2)*r/2))};
const nasaUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='eonet.gsfc.nasa.gov'&&/^\/api\/v3\/events\//.test(url.pathname)?url.href:null}catch{return null}};

export function buildEonetNflSnapshot(raw,games,now=Date.now()){
  if(raw?.type!=='FeatureCollection'||!Array.isArray(raw.features)||raw.features.length>5000||!Array.isArray(games))throw Error('Invalid bounded NASA EONET collection');
  const latest=new Map();
  for(const feature of raw.features){
    const p=feature?.properties,id=p?.id,at=time(p?.date);
    if(typeof id!=='string'||!/^[A-Za-z0-9_-]{3,80}$/.test(id)||!Number.isFinite(at)||at>now+2*HOUR||now-at>7*24*HOUR||p.closed!=null)continue;
    if(!latest.has(id)||at>latest.get(id).at)latest.set(id,{feature,at});
  }
  const points=[...latest.values()].flatMap(({feature,at})=>{
    const p=feature.properties,geometry=feature.geometry,[lon,lat]=geometry?.coordinates||[];
    if(geometry?.type!=='Point'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180)return [];
    const sourceUrl=nasaUrl(p.link);
    if(!sourceUrl||typeof p.title!=='string'||!p.title.trim())return [];
    return [{id:p.id,title:p.title.slice(0,240),categories:(Array.isArray(p.categories)?p.categories:[]).map(item=>String(item.title||'').slice(0,80)).filter(Boolean).slice(0,3),sourceAt:new Date(at).toISOString(),sourceUrl,lat,lon}];
  });
  const venues=new Map(games.map(game=>[game.venue?.id,game.venue]).filter(([id,venue])=>id&&Number.isFinite(venue?.lat)&&Number.isFinite(venue?.lon)));
  const byVenue={};
  for(const [id,venue] of venues){
    const matches=points.map(point=>({...point,distanceKm:Math.round(km(venue.lat,venue.lon,point.lat,point.lon)*10)/10})).filter(item=>item.distanceKm<=250).sort((a,b)=>a.distanceKm-b.distanceKm||Date.parse(b.sourceAt)-Date.parse(a.sourceAt)).slice(0,5);
    if(matches.length)byVenue[id]=matches;
  }
  return {schema:'event-atlas.eonet-nfl.v1',status:'ok',builtAt:new Date(now).toISOString(),sourceUrl:eonetSourceUrl,sourceFeatureCount:raw.features.length,latestPointCount:points.length,byVenue,interpretation:'NASA EONET open natural-event metadata. The latest geometry for each event is used only when it is a point dated within seven days. A point within 250 km is regional context, not a forecast, verified active incident, venue impact, or threat. The 500-event query, source curation and point-only screen are incomplete.'};
}

export function selectEonetForGame(game,snapshot,now=Date.now(),monitoringMode='near_term_monitoring'){
  if(monitoringMode!=='near_term_monitoring')return {state:'not_started',asOf:null,sourceUrl:eonetSourceUrl,events:[],interpretation:'Current natural-event points are not screened as context for games outside the near-term monitoring window.'};
  const at=time(snapshot?.builtAt),current=snapshot?.schema==='event-atlas.eonet-nfl.v1'&&snapshot.status==='ok'&&snapshot.sourceUrl===eonetSourceUrl&&Number.isFinite(at)&&at<=now+60000&&now-at<=12*HOUR;
  if(!current)return {state:'stale_or_unavailable',asOf:null,sourceUrl:eonetSourceUrl,events:[]};
  const events=(snapshot.byVenue?.[game?.venue?.id]||[]).filter(item=>item&&nasaUrl(item.sourceUrl)&&Number.isFinite(item.distanceKm)&&item.distanceKm>=0&&item.distanceKm<=250&&Number.isFinite(time(item.sourceAt))&&time(item.sourceAt)<=now+2*HOUR&&now-time(item.sourceAt)<=7*24*HOUR).slice(0,5);
  return {state:'current_snapshot',asOf:snapshot.builtAt,sourceUrl:eonetSourceUrl,events,interpretation:snapshot.interpretation};
}
