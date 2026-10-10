import {cameraSourceIdsForVenue,roadSourceIdsForVenue} from './venue_source_scope.js';

const HOUR=3600000;

function feedState(venue,snapshot,kind,now){
  if(!snapshot)return 'unavailable';
  const builtAt=Date.parse(snapshot.builtAt);
  if(!Number.isFinite(builtAt)||builtAt>now+HOUR||now-builtAt>12*HOUR)return 'stale';
  if(Object.hasOwn(snapshot.byVenue||{},venue.id))return 'connected';
  const expected=kind==='camera'?cameraSourceIdsForVenue(venue):roadSourceIdsForVenue(venue);
  const sourceStatus=new Map((snapshot.sources||[]).map(source=>[source.id,source.status]));
  if(expected.some(id=>sourceStatus.get(id)==='directory_only'))return 'directory_only';
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
