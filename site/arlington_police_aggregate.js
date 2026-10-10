export const arlingtonPoliceLayer='https://gis2.arlingtontx.gov/agsext2/rest/services/Police/ActiveIncident/MapServer/0';

export function arlingtonAggregateQueries(venue){
  if(venue?.id!=='3687'||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||venue.lat<32||venue.lat>33.5||venue.lon< -98||venue.lon> -96)throw Error('Verified Arlington venue candidate required');
  const base=`${arlingtonPoliceLayer}/query`;
  const count=new URL(base);
  count.search=new URLSearchParams({where:'1=1',geometry:`${venue.lon},${venue.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',distance:'5000',units:'esriSRUnit_Meter',returnCountOnly:'true',f:'json'});
  const latest=new URL(base);
  latest.search=new URLSearchParams({where:'1=1',outFields:'UpdatedDate',returnGeometry:'false',orderByFields:'UpdatedDate DESC',resultRecordCount:'1',f:'json'});
  return {countUrl:count.href,latestUrl:latest.href,radiusKm:5};
}

export function summarizeArlingtonAggregate(countResponse,latestResponse,checkedAt=Date.now()){
  const count=countResponse?.count,items=latestResponse?.features,latest=items?.[0]?.attributes?.UpdatedDate;
  if(countResponse?.error||latestResponse?.error||!Number.isSafeInteger(count)||count<0||count>100000||!Array.isArray(items)||items.length!==1||!Number.isFinite(latest)||latest>checkedAt+60000||checkedAt-latest>3*3600000)throw Error('Arlington police aggregate is incomplete or stale');
  return {nearby:count,radiusKm:5,sourceLatestAt:latest,sourceLagMinutes:Math.round((checkedAt-latest)/60000),checkedAt,status:'delayed_public_listing'};
}
