export const airnowRsigBase='https://ofmpub.epa.gov/rsig/rsigserver';
export const airnowDocs='https://www.epa.gov/hesc/web-access-rsig-data';
const HOUR=3600000;
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((c-a)*r,(d-b)*r*Math.cos((a+c)*r/2))};
export function airnowQueryUrl(now=Date.now()){
  const end=Math.floor((now-HOUR)/HOUR)*HOUR,start=end-6*HOUR;
  const url=new URL(airnowRsigBase);
  for(const [key,value] of Object.entries({SERVICE:'wcs',VERSION:'1.0.0',REQUEST:'GetCoverage',COVERAGE:'airnow.pm25',FORMAT:'ascii',TIME:`${new Date(start).toISOString().replace('.000','')}/${new Date(end+HOUR-1000).toISOString().replace('.000','')}`,BBOX:'-126,24,-66,50'}))url.searchParams.set(key,value);
  return url.href;
}
export function buildAirnowSnapshot(raw,games,sourceUrl,now=Date.now()){
  if(typeof raw!=='string'||raw.length>5000000||!raw.startsWith('Timestamp(UTC)\tLONGITUDE(deg)\tLATITUDE(deg)\tSTATION(-)\tpm25(ug/m3)\tSITE_NAME\n')||!Array.isArray(games))throw Error('Invalid EPA AirNow table');
  const lines=raw.trimEnd().split('\n');
  if(lines.length>25000)throw Error('EPA AirNow table exceeds row limit');
  const latest=new Map();let invalid=0;
  for(const line of lines.slice(1)){
    const [timestamp,lonText,latText,stationText,valueText,siteText]=line.split('\t');
    const at=Date.parse(timestamp?.replace(/-0000$/,'Z')),lon=Number(lonText),lat=Number(latText),value=Number(valueText),station=stationText?.trim();
    if(!Number.isFinite(at)||!Number.isFinite(lon)||!Number.isFinite(lat)||lon< -126||lon> -66||lat<24||lat>50||!/^\d{1,8}$/.test(station||'')||!Number.isFinite(value)||value<0||value>2000){invalid++;continue}
    if(at>now+60000||now-at>8*HOUR)continue;
    const siteCode=siteText?.trim().split(';')[0]||null,key=station;
    if(!latest.has(key)||at>latest.get(key).at)latest.set(key,{stationId:station,siteCode:/^[A-Za-z0-9-]{4,30}$/.test(siteCode||'')?siteCode:null,lat,lon,at,pm25:value});
  }
  if(lines.length>1&&invalid/(lines.length-1)>0.1)throw Error('EPA AirNow table has too many invalid rows');
  const stations=[...latest.values()],venues=new Map(games.map(g=>[g.venue?.id,g.venue]).filter(([id,v])=>id&&Number.isFinite(v?.lat)&&Number.isFinite(v?.lon)));
  const byVenue={};
  for(const [id,venue] of venues){
    const current=stations.filter(s=>now-s.at<=4*HOUR).map(s=>({...s,distanceKm:Math.round(distance(venue.lat,venue.lon,s.lat,s.lon)*10)/10})).filter(s=>s.distanceKm<=50).sort((a,b)=>a.distanceKm-b.distanceKm||b.at-a.at)[0];
    if(current)byVenue[id]={stationId:current.stationId,siteCode:current.siteCode,lat:current.lat,lon:current.lon,distanceKm:current.distanceKm,observedAt:new Date(current.at).toISOString(),pm25UgM3:Math.round(current.pm25*10)/10,sourceUrl};
  }
  return {schema:'event-atlas.airnow-pm25.v1',status:'ok',builtAt:new Date(now).toISOString(),sourceUrl,docsUrl:airnowDocs,sourceRowCount:lines.length-1,invalidRowCount:invalid,stationCount:stations.length,byVenue,interpretation:'EPA RSIG AirNow preliminary PM2.5 station concentration in micrograms per cubic meter. Nearest station within 50 km with a measurement no older than four hours. This is not a stadium measurement, AQI, forecast, smoke attribution, health instruction, or evidence of a wildfire effect.'};
}
export function selectAirnowForGame(game,snapshot,now=Date.now(),mode='near_term_monitoring'){
  if(mode!=='near_term_monitoring')return {state:'not_started',asOf:null,sourceUrl:airnowDocs,observation:null};
  const at=Date.parse(snapshot?.builtAt),url=snapshot?.sourceUrl;
  if(snapshot?.schema!=='event-atlas.airnow-pm25.v1'||snapshot.status!=='ok'||!/^https:\/\/ofmpub\.epa\.gov\/rsig\/rsigserver\?/.test(url||'')||!Number.isFinite(at)||at>now+60000||now-at>12*HOUR)return {state:'stale_or_unavailable',asOf:null,sourceUrl:airnowDocs,observation:null};
  if(!snapshot.byVenue||typeof snapshot.byVenue!=='object'||Array.isArray(snapshot.byVenue))return {state:'stale_or_unavailable',asOf:null,sourceUrl:airnowDocs,observation:null};
  const item=snapshot.byVenue?.[game?.venue?.id],age=now-Date.parse(item?.observedAt);
  const valid=item&&item.sourceUrl===url&&/^\d{1,8}$/.test(item.stationId||'')&&Number.isFinite(item.distanceKm)&&item.distanceKm>=0&&item.distanceKm<=50&&Number.isFinite(item.pm25UgM3)&&item.pm25UgM3>=0&&item.pm25UgM3<=2000&&Number.isFinite(age)&&age>=-60000&&age<=4*HOUR;
  if(Object.hasOwn(snapshot.byVenue,game?.venue?.id)&&!valid)return {state:'stale_or_unavailable',asOf:snapshot.builtAt,sourceUrl:url,observation:null};
  return {state:valid?'current_station_observation':'no_current_nearby_station',asOf:snapshot.builtAt,sourceUrl:url,observation:valid?item:null,interpretation:snapshot.interpretation};
}
