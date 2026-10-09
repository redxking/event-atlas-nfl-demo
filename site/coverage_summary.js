const HOUR=3600000;

function feedState(id,snapshot,now){
  if(!snapshot)return 'unavailable';
  const builtAt=Date.parse(snapshot.builtAt);
  if(!Number.isFinite(builtAt)||builtAt>now+HOUR||now-builtAt>12*HOUR)return 'stale';
  return Object.hasOwn(snapshot.byVenue||{},id)?'connected':'not_connected';
}

export function summarizeCoverage(games,cameras,roads,now=Date.now()){
  const venues=[...new Map(games.map(game=>[game.venue.id,game.venue])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name));
  const rows=venues.map(venue=>({id:venue.id,name:venue.name,address:venue.address,
    point:Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)?'candidate':'unmapped',
    camera:feedState(venue.id,cameras,now),road:feedState(venue.id,roads,now)}));
  return {rows,total:rows.length,points:rows.filter(row=>row.point==='candidate').length,
    cameras:rows.filter(row=>row.camera==='connected').length,
    roads:rows.filter(row=>row.road==='connected').length,
    cameraFailed:cameras?.sources?.filter(source=>source.status==='failed').map(source=>source.id)||[],
    roadFailed:roads?.sources?.filter(source=>source.status==='failed').map(source=>source.id)||[]};
}
