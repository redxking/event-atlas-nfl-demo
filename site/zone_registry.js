const validPoint=point=>Array.isArray(point)&&point.length===2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;
const validRing=ring=>Array.isArray(ring)&&ring.length>=4&&ring.length<=2000&&ring.every(validPoint)&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1];
const ringsFrom=value=>(value?.outerRings||[value?.ring]).filter(validRing);

export function buildVenueZoneRegistry(game,{ground,airspace,tfr}={}){
  const venueId=game?.venue?.id,groundRecord=ground?.byVenue?.[venueId],airRecord=airspace?.byGame?.[game?.id];
  const zones=[];
  const groundRings=ringsFrom(groundRecord);
  if(groundRings.length)zones.push({id:`ground-candidate:${venueId}`,type:'ground_footprint_candidate',authority:'OpenStreetMap contributor mapping; venue operator approval absent',approvalState:'unreviewed_research_candidate',sourceUrl:groundRecord.sourceUrl||null,sourceVersion:groundRecord.sourceVersion||null,sourceAt:groundRecord.sourceEditedAt||null,effectiveFrom:null,effectiveUntil:null,geometry:{type:'MultiPolygon',coordinates:groundRings.map(ring=>[ring])}});
  if(validRing(airRecord?.ring))zones.push({id:`faa-seams:${game.id}`,type:'published_airspace_restriction',authority:'FAA SEAMS',approvalState:'published_source_record_not_notam_verification',sourceUrl:airspace?.sourceItemUrl||null,sourceVersion:airRecord.objectId||null,sourceAt:airRecord.sourceUpdatedAt||null,effectiveFrom:airRecord.startAt||null,effectiveUntil:airRecord.endAt||null,geometry:{type:'Polygon',coordinates:[airRecord.ring]}});
  for(const item of (tfr?.byVenue?.[venueId]||[]).slice(0,25))if(validRing(item.ring))zones.push({id:`faa-tfr:${item.notamId}`,type:'published_airspace_notice_candidate',authority:'FAA TFR',approvalState:'source_shape_intersects_venue_point_not_event_attribution',sourceUrl:item.detailUrl||tfr?.sourcePageUrl||null,sourceVersion:item.notamKey||null,sourceAt:item.sourceModified||null,effectiveFrom:item.windowState==='single_explicit_utc_window'?item.startAt:null,effectiveUntil:item.windowState==='single_explicit_utc_window'?item.endAt:null,geometry:{type:'Polygon',coordinates:[item.ring]}});
  return {schema:'event-atlas.venue-zone-registry.v1',status:'research_geometry_only',venueId,zones,gaps:['No venue-operator-approved ground security geofence or gate geometry.','FAA airspace notices do not define a ground perimeter or detect drones.']};
}

function pointInRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    const cross=(lon-xi)*(yj-yi)-(lat-yi)*(xj-xi);
    if(Math.abs(cross)<1e-10&&lon>=Math.min(xi,xj)&&lon<=Math.max(xi,xj)&&lat>=Math.min(yi,yj)&&lat<=Math.max(yi,yj))return true;
    if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}

export function screenPointAgainstZones(registry,{lat,lon,observedAt}={}){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Valid observation point required');
  const at=observedAt==null?null:Date.parse(observedAt);
  if(observedAt!=null&&!Number.isFinite(at))throw Error('Valid observation time required');
  return (registry?.zones||[]).filter(zone=>{
    const rings=zone.geometry?.type==='MultiPolygon'?zone.geometry.coordinates.map(polygon=>polygon[0]):zone.geometry?.type==='Polygon'?[zone.geometry.coordinates[0]]:[];
    return rings.some(ring=>pointInRing(lon,lat,ring));
  }).map(zone=>{
    const start=Date.parse(zone.effectiveFrom),end=Date.parse(zone.effectiveUntil);
    const timeRelation=at===null||!Number.isFinite(start)||!Number.isFinite(end)?'unverified':at>=start&&at<=end?'within_published_window':'outside_published_window';
    return {zoneId:zone.id,zoneType:zone.type,relation:'inside_published_geometry',timeRelation,approvalState:zone.approvalState,sourceUrl:zone.sourceUrl,interpretation:'Spatial and time screening only; no incident, threat, drone or person attribution.'};
  });
}
