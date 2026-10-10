export const denverCrimeLayer='https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_CRIME_OFFENSES_P/FeatureServer/324';
const DAY=86400000;

export function denverCrimeQueries(venue,now=Date.now()){
  if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon)||!Number.isFinite(now))throw Error('Denver query requires a venue point and time');
  const end=new Date(Math.floor(now/DAY)*DAY-7*DAY).toISOString().slice(0,10);
  const start=new Date(Date.parse(`${end}T00:00:00Z`)-30*DAY).toISOString().slice(0,10);
  const base=`${denverCrimeLayer}/query`;
  const count=new URL(base);
  count.search=new URLSearchParams({where:`IS_CRIME = 1 AND REPORTED_DATE >= TIMESTAMP '${start} 00:00:00' AND REPORTED_DATE < TIMESTAMP '${end} 00:00:00'`,geometry:`${venue.lon},${venue.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',distance:'5000',units:'esriSRUnit_Meter',returnCountOnly:'true',f:'json'});
  const latest=new URL(base);
  latest.search=new URLSearchParams({where:`IS_CRIME = 1 AND REPORTED_DATE >= TIMESTAMP '${start} 00:00:00'`,outStatistics:JSON.stringify([{statisticType:'max',onStatisticField:'REPORTED_DATE',outStatisticFieldName:'latest'}]),f:'json'});
  return {countUrl:count.href,latestUrl:latest.href,start,end,radiusKm:5};
}

export function summarizeDenverCrimes(countResponse,latestResponse,query,checkedAt){
  const count=countResponse?.count,latest=latestResponse?.features?.[0]?.attributes?.latest;
  if(countResponse?.error||latestResponse?.error||!Number.isSafeInteger(count)||count<0||!Number.isFinite(latest)||latest>checkedAt+60000||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(query?.start)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(query?.end)||query.radiusKm!==5)throw Error('Denver aggregate source response is incomplete');
  const lagHours=Math.round((checkedAt-latest)/3600000*10)/10;
  return {nearby:count,start:query.start,end:query.end,radiusKm:5,sourceLatestAt:latest,sourceLagHours:lagHours,checkedAt,status:checkedAt-latest<=14*DAY?'delayed_historical':'stale_source'};
}
