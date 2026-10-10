export const hmsDocs='https://www.ospo.noaa.gov/products/land/hms.html';
const HOUR=3600000;
const sourceUrl=value=>/^https:\/\/satepsanone\.nesdis\.noaa\.gov\/pub\/FIRE\/web\/HMS\/Smoke_Polygons\/KML\/\d{4}\/\d{2}\/hms_smoke\d{8}\.kml$/.test(value||'');
export function selectHmsSmokeForGame(game,snapshot,now=Date.now(),mode='near_term_monitoring'){
  if(mode!=='near_term_monitoring')return {state:'not_started',asOf:null,sourceUrl:hmsDocs,polygons:[]};
  const at=Date.parse(snapshot?.builtAt),latest=Date.parse(snapshot?.latestPolygonEndAt);
  if(snapshot?.schema!=='event-atlas.hms-smoke.v1'||snapshot.status!=='ok'||!sourceUrl(snapshot.sourceUrl)||!Number.isFinite(at)||at>now+60000||now-at>12*HOUR||!Number.isFinite(latest)||latest>now+2*HOUR||now-latest>36*HOUR)return {state:'stale_or_unavailable',asOf:null,sourceUrl:hmsDocs,polygons:[]};
  const polygons=(snapshot.byVenue?.[game?.venue?.id]||[]).filter(item=>Number.isInteger(item?.polygonIndex)&&item.polygonIndex>=0&&['light','medium','heavy'].includes(item.density)&&item.sourceUrl===snapshot.sourceUrl&&Number.isFinite(Date.parse(item.endAt))&&Date.parse(item.endAt)<=now+2*HOUR&&now-Date.parse(item.endAt)<=36*HOUR).slice(0,3);
  return {state:'recent_daily_analysis',asOf:snapshot.builtAt,analysisDate:snapshot.analysisDate,sourceUrl:snapshot.sourceUrl,polygons,interpretation:snapshot.interpretation};
}
