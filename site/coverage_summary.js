const HOUR=3600000;
const configuredSources={
  camera:{CA:['caltrans-d4','caltrans-d7'],WA:['wsdot-seattle'],MD:['md-chart-cameras','md-imap-cameras'],GA:['gdot-atlanta-cameras'],IL:['idot-gateway-chicago'],WI:['wisdot-511-green-bay'],PA:['penndot-camera-inventory']},
  road:{CA:['caltrans-lcs-d4','caltrans-lcs-d7'],WA:['wsdot-road-alerts'],MD:['md-chart-incidents','md-chart-closures'],IL:['idot-closure-incidents'],WI:['wisdot-511-events-green-bay'],LA:['ladotd-511-new-orleans'],TN:['tdot-smartway-nashville'],NJ:['njit-transcom-wzdx'],NC:['ncdot-drivenc-wzdx'],MO:['modot-wzdx']}
};

function feedState(venue,snapshot,kind,now){
  if(!snapshot)return 'unavailable';
  const builtAt=Date.parse(snapshot.builtAt);
  if(!Number.isFinite(builtAt)||builtAt>now+HOUR||now-builtAt>12*HOUR)return 'stale';
  if(Object.hasOwn(snapshot.byVenue||{},venue.id))return 'connected';
  const state=venue.address?.match(/\b([A-Z]{2}), USA$/)?.[1];
  const expected=configuredSources[kind][state]||[];
  const sourceStatus=new Map((snapshot.sources||[]).map(source=>[source.id,source.status]));
  if(expected.some(id=>sourceStatus.get(id)==='failed')&&!expected.some(id=>sourceStatus.get(id)==='ok'))return 'source_failed';
  return 'not_connected';
}

export function summarizeCoverage(games,cameras,roads,now=Date.now()){
  const venues=[...new Map(games.map(game=>[game.venue.id,game.venue])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name));
  const rows=venues.map(venue=>({id:venue.id,name:venue.name,address:venue.address,lat:venue.lat,lon:venue.lon,
    point:Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)?'candidate':'unmapped',
    camera:feedState(venue,cameras,'camera',now),road:feedState(venue,roads,'road',now)}));
  return {rows,total:rows.length,points:rows.filter(row=>row.point==='candidate').length,
    cameras:rows.filter(row=>row.camera==='connected').length,
    roads:rows.filter(row=>row.road==='connected').length,
    cameraFailed:cameras?.sources?.filter(source=>source.status==='failed').map(source=>source.id)||[],
    roadFailed:roads?.sources?.filter(source=>source.status==='failed').map(source=>source.id)||[]};
}
