const RAD=Math.PI/180;
const DAY=86400000;
const validPoint=point=>Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;
const distanceKm=(lat,lon,point)=>6371*Math.hypot((point[0]-lon)*RAD*Math.cos(lat*RAD),(point[1]-lat)*RAD);

function nearestOnLine(line,lat,lon){
  let best=null;
  const xScale=Math.cos(lat*RAD);
  for(let i=0;i<line.length;i++){
    const a=line[i];if(!validPoint(a))continue;
    let point=a;
    if(i+1<line.length&&validPoint(line[i+1])){
      const b=line[i+1],dx=(b[0]-a[0])*xScale,dy=b[1]-a[1],length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((lon-a[0])*xScale*dx+(lat-a[1])*dy)/length)):0;
      point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
    }
    const km=distanceKm(lat,lon,point);
    if(!best||km<best.distanceKm)best={lon:point[0],lat:point[1],distanceKm:km};
  }
  return best;
}

export function closestWzdxPoint(geometry,lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const lines=geometry?.type==='LineString'?[geometry.coordinates]:geometry?.type==='MultiLineString'?geometry.coordinates:geometry?.type==='MultiPoint'?geometry.coordinates?.map(point=>[point]):geometry?.type==='Point'?[[geometry.coordinates]]:[];
  if(!Array.isArray(lines))return null;
  return lines.map(line=>Array.isArray(line)?nearestOnLine(line,lat,lon):null).filter(Boolean).sort((a,b)=>a.distanceKm-b.distanceKm)[0]||null;
}

export function parseWzdxNearVenue(data,venue,now,seasonEnd,{agency,sourceUrl}){
  if(typeof agency!=='string'||!agency||typeof sourceUrl!=='string'||!sourceUrl.startsWith('https://'))throw Error('WZDx source identity and HTTPS URL required');
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.feed_info)throw Error('Invalid WZDx work-zone feed');
  const updated=Date.parse(data.feed_info.update_date);
  if(!Number.isFinite(updated)||updated>now+3600000||now-updated>DAY)throw Error('WZDx feed update is missing or older than 24 hours');
  const records=[];
  for(const feature of data.features){
    const p=feature.properties||{},core=p.core_details||{},start=Date.parse(p.start_date),end=Date.parse(p.end_date);
    if(!feature.id||core.event_type!=='work-zone'||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end<now||start>seasonEnd)continue;
    const nearest=closestWzdxPoint(feature.geometry,venue.lat,venue.lon);
    if(!nearest||nearest.distanceKm>10)continue;
    const sourceAt=Date.parse(core.update_date);
    records.push({id:`wzdx-${feature.id}`,agency,kind:'Publisher-listed work zone',name:(Array.isArray(core.road_names)?core.road_names.slice(0,3).join(' · '):'')||'Unnamed work zone',detail:String(core.description||'').slice(0,1000),lat:nearest.lat,lon:nearest.lon,distanceKm:Math.round(nearest.distanceKm*10)/10,startAt:null,endAt:null,sourceRecordDate:Number.isFinite(sourceAt)?new Date(sourceAt).toISOString():null,sourceUrl,timingPolicy:'source_listed_only',timeNote:'WZDx start/end dates filter expired records but are not verified as active work at kickoff; geometry is the nearest published line or point, not a route-impact assessment.'});
  }
  return records.sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,50);
}
