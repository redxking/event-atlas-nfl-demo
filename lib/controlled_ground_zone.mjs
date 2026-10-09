const RAD=Math.PI/180;
const validPoint=point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;
const validText=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
const validTime=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const km=(a,b,c,d)=>6371*Math.hypot((d-b)*RAD*Math.cos((a+c)*RAD/2),(c-a)*RAD);
const meters=(point,origin)=>[(point[0]-origin[0])*111320*Math.cos(origin[1]*RAD),(point[1]-origin[1])*110574];
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment=(a,b,p)=>Math.abs(orient(a,b,p))<1e-12&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
const intersects=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0||[c,d].some(p=>onSegment(a,b,p))||[a,b].some(p=>onSegment(c,d,p));

function validateRing(ring,venue){
  if(!Array.isArray(ring)||ring.length<4||ring.length>501||ring.some(point=>!validPoint(point)))throw Error('Closed WGS84 polygon with 3–500 distinct vertices required');
  const [first,last]=[ring[0],ring.at(-1)];
  if(first[0]!==last[0]||first[1]!==last[1])throw Error('Ground zone polygon must be closed');
  if(new Set(ring.slice(0,-1).map(point=>point.join(','))).size!==ring.length-1)throw Error('Ground zone polygon has repeated vertices');
  if(ring.some(([lon,lat])=>km(venue.lat,venue.lon,lat,lon)>5))throw Error('Ground zone vertex is over 5 km from the event venue candidate point');
  for(let i=0;i<ring.length-1;i++)for(let j=i+2;j<ring.length-1;j++){
    if(i===0&&j===ring.length-2)continue;
    if(intersects(ring[i],ring[i+1],ring[j],ring[j+1]))throw Error('Ground zone polygon crosses itself');
  }
  const origin=[venue.lon,venue.lat],points=ring.map(point=>meters(point,origin));
  const twiceArea=points.slice(0,-1).reduce((sum,point,index)=>sum+point[0]*points[index+1][1]-points[index+1][0]*point[1],0);
  if(Math.abs(twiceArea)/2<25||Math.abs(twiceArea)/2>25000000)throw Error('Ground zone area must be between 25 square meters and 25 square kilometers');
  return ring.map(point=>[...point]);
}

export function normalizeGroundZone(input,game,now=Date.now()){
  const venue=game?.venue,kickoff=Date.parse(game?.kickoff),from=Date.parse(input?.effectiveFrom),until=Date.parse(input?.effectiveUntil);
  if(!game?.id||!venue?.id||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||!Number.isFinite(kickoff)||game.timeTbd||/cancelled/i.test(game.status||''))throw Error('Current NFL event with a listed kickoff and venue point required');
  if(!validText(input?.name,3,120)||!validText(input?.purpose,20,500)||!validText(input?.sourceAuthority,3,200)||!validText(input?.sourceReference,8,500)||!validText(input?.authorityBasis,30,2000))throw Error('Ground zone name, purpose, source authority, reference and authority basis required');
  if(!validTime(input?.effectiveFrom)||!validTime(input?.effectiveUntil)||from>kickoff||until<kickoff||until<=from||until-from>7*86400000||until<=now)throw Error('Ground zone must have a future-valid interval of at most seven days covering listed kickoff');
  const geometry=input?.geometry;
  if(geometry?.type!=='Polygon'||!Array.isArray(geometry.coordinates)||geometry.coordinates.length!==1)throw Error('Single-ring WGS84 Polygon required');
  const ring=validateRing(geometry.coordinates[0],venue);
  return {name:input.name.trim(),purpose:input.purpose.trim(),sourceAuthority:input.sourceAuthority.trim(),sourceReference:input.sourceReference.trim(),authorityBasis:input.authorityBasis.trim(),effectiveFrom:new Date(from).toISOString(),effectiveUntil:new Date(until).toISOString(),eventId:game.id,venueId:venue.id,venuePointStatus:venue.coordinateStatus||'unreviewed candidate',geometry:{type:'Polygon',coordinates:[ring]},dataClass:'internal_case_only',interpretation:'Operator-supplied geometry pending independent review; source authority and field validity are not verified by the application.'};
}

function pointRelation(point,ring){
  const origin=point,xy=ring.map(vertex=>meters(vertex,origin));
  let inside=false,minDistance=Infinity;
  for(let i=0;i<xy.length-1;i++){
    const a=xy[i],b=xy[i+1],dx=b[0]-a[0],dy=b[1]-a[1],lengthSquared=dx*dx+dy*dy,fraction=lengthSquared?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/lengthSquared)):0;
    minDistance=Math.min(minDistance,Math.hypot(a[0]+fraction*dx,a[1]+fraction*dy));
    if((a[1]>0)!==(b[1]>0)&&0<(b[0]-a[0])*(-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return minDistance<=20?'boundary_review':inside?'inside':'outside';
}

export function screenControlledGroundZones(zones,game,observation,now=Date.now()){
  const {lat,lon,observedAt}=observation||{},at=Date.parse(observedAt);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!validTime(observedAt)||at>now+60000)throw Error('Valid point and observed time required');
  return zones.filter(zone=>zone.status==='approved_for_local_screening'&&!zone.revokedAt&&zone.eventId===game.id&&zone.venueId===game.venue.id&&Date.parse(zone.effectiveUntil)>now).map(zone=>({zoneId:zone.id,name:zone.name,relation:pointRelation([lon,lat],zone.geometry.coordinates[0]),timeRelation:at<Date.parse(zone.effectiveFrom)?'before_effective_window':at>Date.parse(zone.effectiveUntil)?'after_effective_window':'within_effective_window',approvalState:'independently_reviewed_for_local_screening',sourceAuthority:zone.sourceAuthority,sourceReference:zone.sourceReference,interpretation:'Point and time relation only. Boundary tolerance is 20 m; no person, incident, threat, drone or field operation is inferred.'}));
}
