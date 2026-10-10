export const seattleCallsLayer='https://utility.arcgis.com/usrsvcs/servers/5dc6326b7a0149979ab447a57cda8d67/rest/services/secure/911IncidentResponses/MapServer/0';
export const seattleCallsViewer='https://experience.arcgis.com/experience/6ee2574e047d4cdb9cb5ad287b76d091';

function seattleLocalSqlTime(value){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function seattleCallQueries(venue,checkedAt=Date.now()){
  if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon))throw Error('Venue point unavailable');
  const point=new URLSearchParams({where:`ORIG_TIME_QUEUED >= TIMESTAMP '${seattleLocalSqlTime(checkedAt-12*3600000)}'`,geometry:`${venue.lon},${venue.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',distance:'5000',units:'esriSRUnit_Meter',spatialRel:'esriSpatialRelIntersects',returnIdsOnly:'true',f:'json'});
  const latest=new URLSearchParams({where:'1=1',outFields:'ORIG_TIME_QUEUED',returnGeometry:'false',orderByFields:'ORIG_TIME_QUEUED DESC',resultRecordCount:'1',f:'json'});
  return {countUrl:`${seattleCallsLayer}/query?${point}`,latestUrl:`${seattleCallsLayer}/query?${latest}`};
}

export function summarizeSeattleCalls(countResponse,latestResponse,checkedAt=Date.now()){
  if(countResponse?.error||latestResponse?.error)throw Error('Seattle CAD source rejected the query');
  if(!countResponse||!Object.hasOwn(countResponse,'objectIds')||countResponse.exceededTransferLimit)throw Error('Seattle CAD count response is incomplete');
  const ids=countResponse?.objectIds;
  if(ids!==null&&!Array.isArray(ids)||Array.isArray(ids)&&(ids.length>10000||new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(id))))throw Error('Seattle CAD count response is invalid');
  const latest=latestResponse?.features;
  if(!Array.isArray(latest)||latest.length!==1)throw Error('Seattle CAD latest record is unavailable');
  const latestAt=latest[0]?.attributes?.ORIG_TIME_QUEUED;
  if(!Number.isFinite(latestAt)||latestAt>checkedAt+60000||checkedAt-latestAt>30*60000)throw Error('Seattle CAD source has no recent update');
  return {nearby:ids?.length||0,windowCount:null,gameWindowCurrent:false,newestUpdate:latestAt,periodHours:12,radiusKm:5};
}
