export const charlotteIncidentsLayer='https://gis.charlottenc.gov/arcgis/rest/services/CMPD/CMPDIncidents/MapServer/0';
const DAY=86400000;

export function charlotteIncidentQueries(venue,now=Date.now()){
  if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon)||!Number.isFinite(now))throw Error('Charlotte query requires a venue point and time');
  const end=new Date(Math.floor(now/DAY)*DAY-DAY).toISOString().slice(0,10);
  const start=new Date(Date.parse(`${end}T00:00:00Z`)-7*DAY).toISOString().slice(0,10);
  const base=`${charlotteIncidentsLayer}/query`;
  const count=new URL(base);
  count.search=new URLSearchParams({where:`DATE_REPORTED >= TIMESTAMP '${start} 00:00:00' AND DATE_REPORTED < TIMESTAMP '${end} 00:00:00'`,geometry:`${venue.lon},${venue.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',distance:'5000',units:'esriSRUnit_Meter',returnCountOnly:'true',f:'json'});
  const latest=new URL(base);
  latest.search=new URLSearchParams({where:'1=1',outFields:'DATE_REPORTED',returnGeometry:'false',orderByFields:'DATE_REPORTED DESC',resultRecordCount:'1',f:'json'});
  return {countUrl:count.href,latestUrl:latest.href,start,end,radiusKm:5};
}

export function summarizeCharlotteIncidents(countResponse,latestResponse,query,checkedAt){
  const count=countResponse?.count,latest=latestResponse?.features?.[0]?.attributes?.DATE_REPORTED;
  if(countResponse?.error||latestResponse?.error||!Number.isSafeInteger(count)||count<0||!Number.isFinite(latest)||latest>checkedAt+60000||!/^\d{4}-\d{2}-\d{2}$/.test(query?.start)||!/^\d{4}-\d{2}-\d{2}$/.test(query?.end))throw Error('Charlotte aggregate source response is incomplete');
  const lagHours=Math.round((checkedAt-latest)/3600000*10)/10;
  return {nearby:count,start:query.start,end:query.end,radiusKm:query.radiusKm,sourceLatestAt:latest,sourceLagHours:lagHours,checkedAt,status:checkedAt-latest<=72*3600000?'delayed_historical':'stale_source'};
}
