export const hmsDocs='https://www.ospo.noaa.gov/products/land/hms.html';
const HOUR=3600000;
const sourceUrl=value=>/^https:\/\/satepsanone\.nesdis\.noaa\.gov\/pub\/FIRE\/web\/HMS\/Smoke_Polygons\/KML\/\d{4}\/\d{2}\/hms_smoke\d{8}\.kml$/.test(value||'');
export function selectHmsSmokeForGame(game,snapshot,now=Date.now(),mode='near_term_monitoring'){
  if(mode!=='near_term_monitoring')return {state:'not_started',asOf:null,sourceUrl:hmsDocs,polygons:[]};
  const at=Date.parse(snapshot?.builtAt),latest=Date.parse(snapshot?.latestPolygonEndAt);
  if(snapshot?.schema!=='event-atlas.hms-smoke.v1'||snapshot.status!=='ok'||!sourceUrl(snapshot.sourceUrl)||!Number.isFinite(at)||at>now+60000||now-at>12*HOUR||!Number.isFinite(latest)||latest>now+2*HOUR||now-latest>36*HOUR)return {state:'stale_or_unavailable',asOf:null,sourceUrl:hmsDocs,polygons:[]};
  const venueMap=snapshot.byVenue;
  if(!venueMap||typeof venueMap!=='object'||Array.isArray(venueMap))return {state:'stale_or_unavailable',asOf:null,sourceUrl:hmsDocs,polygons:[]};
  const records=Object.hasOwn(venueMap,game?.venue?.id)?venueMap[game.venue.id]:[];
  if(!Array.isArray(records)||records.length>3)return {state:'stale_or_unavailable',asOf:null,sourceUrl:hmsDocs,polygons:[]};
  const polygons=records.filter(item=>Number.isInteger(item?.polygonIndex)&&item.polygonIndex>=0&&['light','medium','heavy'].includes(item.density)&&item.sourceUrl===snapshot.sourceUrl&&Number.isFinite(Date.parse(item.startAt))&&Date.parse(item.startAt)<=Date.parse(item.endAt)&&Number.isFinite(Date.parse(item.endAt))&&Date.parse(item.endAt)<=now+2*HOUR&&now-Date.parse(item.endAt)<=36*HOUR).slice(0,3);
  if(polygons.length!==records.length)return {state:'stale_or_unavailable',asOf:null,sourceUrl:hmsDocs,polygons:[]};
  return {state:'recent_daily_analysis',asOf:snapshot.builtAt,analysisDate:snapshot.analysisDate,sourceUrl:snapshot.sourceUrl,polygons,interpretation:snapshot.interpretation};
}
