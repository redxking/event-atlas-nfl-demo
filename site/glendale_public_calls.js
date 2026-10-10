export const glendaleCallsLayer='https://gismaps.glendaleaz.com/gisserver/rest/services/OpenData/Police_Calls_for_Service/MapServer/1';
export const glendaleCallsViewer='https://gismaps.glendaleaz.com/gisportal/apps/dashboards/e3544958a0f04717ac965bff7c3dda4c';
const DAY=86400000;

export function glendaleCallsQueries(now=Date.now()){
  if(!Number.isFinite(now))throw Error('Glendale query requires a valid time');
  const end=new Date(Math.floor(now/DAY)*DAY-2*DAY).toISOString().slice(0,10);
  const start=new Date(Date.parse(`${end}T00:00:00Z`)-7*DAY).toISOString().slice(0,10);
  const base=`${glendaleCallsLayer}/query`;
  const count=new URL(base);
  count.search=new URLSearchParams({where:`ZipCode = '85305' AND CallDatetime >= TIMESTAMP '${start} 00:00:00' AND CallDatetime < TIMESTAMP '${end} 00:00:00'`,returnCountOnly:'true',f:'json'});
  const latest=new URL(base);
  latest.search=new URLSearchParams({where:'1=1',outStatistics:JSON.stringify([{statisticType:'max',onStatisticField:'DateLoaded',outStatisticFieldName:'max_loaded'},{statisticType:'max',onStatisticField:'CallDatetime',outStatisticFieldName:'max_call'}]),f:'json'});
  return {countUrl:count.href,latestUrl:latest.href,start,end,zip:'85305'};
}

export function summarizeGlendaleCalls(countResponse,latestResponse,query,checkedAt){
  const count=countResponse?.count,attributes=latestResponse?.features?.[0]?.attributes||{},loaded=attributes.max_loaded,latest=attributes.max_call;
  if(countResponse?.error||latestResponse?.error||!Number.isSafeInteger(count)||count<0||!Number.isFinite(loaded)||!Number.isFinite(latest)||loaded>checkedAt+60000||latest>checkedAt+60000||query?.zip!=='85305'||!/^\d{4}-\d{2}-\d{2}$/.test(query.start)||!/^\d{4}-\d{2}-\d{2}$/.test(query.end))throw Error('Glendale call aggregate is incomplete');
  return {nearby:count,zip:query.zip,start:query.start,end:query.end,sourceLoadedAt:loaded,sourceLatestAt:latest,sourceLagHours:Math.round((checkedAt-latest)/360000)/10,checkedAt,status:checkedAt-loaded<=72*3600000&&checkedAt-latest<=96*3600000?'delayed_historical':'stale_source'};
}
