export const phillyLanePermitLayer='https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/LaneClosure_Master/FeatureServer/0';
const DAY=86400000;
const isoDay=time=>new Date(time).toISOString().slice(0,10);
const clean=(value,max=120)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
const localGameDay=kickoff=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(kickoff));

export function phillyLanePermitQuery(venue,now,seasonEnd){
  if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon)||!Number.isFinite(now)||!Number.isFinite(seasonEnd)||seasonEnd<now)throw Error('Philadelphia permit query requires venue and season bounds');
  const start=isoDay(Math.floor(now/DAY)*DAY),end=isoDay(Math.floor(seasonEnd/DAY)*DAY+2*DAY);
  const url=new URL(`${phillyLanePermitLayer}/query`);
  url.search=new URLSearchParams({where:`status IN ('Current','Future') AND expirationdate >= TIMESTAMP '${start} 00:00:00' AND effectivedate < TIMESTAMP '${end} 00:00:00'`,geometry:`${venue.lon},${venue.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',distance:'2000',units:'esriSRUnit_Meter',outFields:'objectid,permitnumber,status,occupancytype,permittype,effectivedate,expirationdate,address',outSR:'4326',returnGeometry:'true',resultRecordCount:'500',f:'geojson'});
  return url.href;
}

const distanceKm=(venue,geometry)=>{
  const lines=geometry?.type==='LineString'?[geometry.coordinates]:geometry?.type==='MultiLineString'?geometry.coordinates:[];
  const scaleY=111.195,scaleX=scaleY*Math.cos(venue.lat*Math.PI/180);
  let best=Infinity;
  for(const line of lines){
    if(!Array.isArray(line)||line.length<2)continue;
    for(let i=1;i<line.length;i++){
      const [lonA,latA]=line[i-1]||[],[lonB,latB]=line[i]||[];
      if(![lonA,latA,lonB,latB].every(Number.isFinite))continue;
      const ax=(lonA-venue.lon)*scaleX,ay=(latA-venue.lat)*scaleY,bx=(lonB-venue.lon)*scaleX,by=(latB-venue.lat)*scaleY;
      const dx=bx-ax,dy=by-ay,t=dx*dx+dy*dy?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy))):0;
      best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));
    }
  }
  return best;
};

export function summarizePhillyLanePermits(collection,games,venue,checkedAt){
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features)||collection.features.length>=500||collection.exceededTransferLimit||!Number.isFinite(checkedAt))throw Error('Philadelphia permit response is incomplete');
  const segments=[];
  for(const feature of collection.features){
    const p=feature?.properties||{},distance=distanceKm(venue,feature.geometry);
    if(!Number.isSafeInteger(p.objectid)||!['Current','Future'].includes(p.status)||!Number.isFinite(p.effectivedate)||!Number.isFinite(p.expirationdate)||!Number.isFinite(distance)||distance>2)continue;
    const effective=isoDay(p.effectivedate),expires=isoDay(p.expirationdate);
    if(expires<effective)continue;
    segments.push({id:p.objectid,permitNumber:clean(p.permitnumber,40),status:p.status,occupancyType:clean(p.occupancytype),permitType:clean(p.permittype),address:clean(p.address),effective,expires,distanceKm:Math.round(distance*10)/10});
  }
  const byGame={};
  for(const game of games.filter(item=>item.venue?.id==='3806'&&Date.parse(item.kickoff)>=checkedAt-5*3600000)){
    const day=localGameDay(game.kickoff),matched=segments.filter(item=>item.effective<=day&&item.expires>=day);
    const permits=new Map();
    for(const item of matched){
      const key=item.permitNumber||`objectid:${item.id}`,prior=permits.get(key);
      if(!prior||item.distanceKm<prior.distanceKm)permits.set(key,item);
    }
    byGame[game.id]={gameDate:day,segmentCount:matched.length,permitCount:permits.size,nearest:[...permits.values()].sort((a,b)=>a.distanceKm-b.distanceKm||a.id-b.id).slice(0,8)};
  }
  return {checkedAt,sourceSegments:collection.features.length,validSegments:segments.length,byGame};
}
