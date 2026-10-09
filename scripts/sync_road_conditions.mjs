import fs from 'node:fs/promises';
const schedule=JSON.parse(await fs.readFile('site/nfl.json','utf8'));
const venues=[...new Map(schedule.games.map(game=>[game.venue.id,game.venue])).values()]
  .filter(venue=>Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)&&/\b(CA|WA|MD|IL), USA$/.test(venue.address));
const km=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};
const now=Date.now(),horizon=now+7*86400000,seasonEnd=Math.max(...schedule.games.map(game=>Date.parse(game.kickoff)).filter(Number.isFinite)),records=[],sources=[];
async function get(url){const response=await fetch(url,{headers:{'User-Agent':'EventAtlas/0.4 public-road-conditions'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()}
for(const district of [4,7]){
  const url=`https://cwwp2.dot.ca.gov/data/d${district}/lcs/lcsStatusD0${district}.json`;
  try{
    const data=await get(url);
    if(!Array.isArray(data.data))throw Error('Invalid lane closure feed');
    let count=0;
    for(const wrapper of data.data){
      const item=wrapper.lcs,begin=item?.location?.begin,closure=item?.closure,time=closure?.closureTimestamp;
      const lat=Number(begin?.beginLatitude),lon=Number(begin?.beginLongitude),start=Number(time?.closureStartEpoch)*1000,end=Number(time?.closureEndEpoch)*1000;
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(start)||start<=0||start>horizon||end<now)continue;
      records.push({id:`caltrans-${district}-${item.index}`,agency:'Caltrans',kind:'Published lane/road closure',name:[begin.beginRoute,begin.beginLocationName].filter(Boolean).join(' · '),detail:[closure.facility,closure.typeOfClosure,closure.typeOfWork].filter(Boolean).join(' · '),lat,lon,startAt:new Date(start).toISOString(),endAt:end>0?new Date(end).toISOString():null,sourceUrl:url,sourceRecordDate:item.recordTimestamp?.recordDate||null});
      count++;
    }
    sources.push({id:`caltrans-lcs-d${district}`,url,status:'ok',records:count});
  }catch(error){sources.push({id:`caltrans-lcs-d${district}`,url,status:'failed',error:String(error)})}
}
const layer='https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoRoadAlerts/FeatureServer/0';
try{
  const params=new URLSearchParams({where:'1=1',geometry:'-122.55,47.35,-122.05,47.85',geometryType:'esriGeometryEnvelope',inSR:'4326',outFields:'OBJECTID,EventCategoryDescription,Road,RoadDirection,HeadlineMessage,LastModifiedDate,RoadClosedFlag',returnGeometry:'true',f:'geojson',resultRecordCount:'2000'});
  const data=await get(`${layer}/query?${params}`);
  if(!Array.isArray(data.features)||data.exceededTransferLimit||data.properties?.exceededTransferLimit)throw Error('Incomplete WSDOT alert feed');
  let count=0;
  for(const feature of data.features){
    const [lon,lat]=feature.geometry?.coordinates||[],p=feature.properties||{};
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isInteger(p.OBJECTID))continue;
    records.push({id:`wsdot-${p.OBJECTID}`,agency:'WSDOT',kind:p.EventCategoryDescription||'Road alert',name:[p.Road,p.RoadDirection].filter(Boolean).join(' · '),detail:p.HeadlineMessage||'',lat,lon,startAt:null,endAt:null,sourceUrl:layer,sourceRecordDate:Number.isFinite(p.LastModifiedDate)?new Date(p.LastModifiedDate).toISOString():null,roadClosed:p.RoadClosedFlag===1});
    count++;
  }
  sources.push({id:'wsdot-road-alerts',url:layer,status:'ok',records:count});
}catch(error){sources.push({id:'wsdot-road-alerts',url:layer,status:'failed',error:String(error)})}
for(const feed of [
  {id:'md-chart-incidents',path:'getEventMapDataJSON.do',kind:'Agency-listed traffic event'},
  {id:'md-chart-closures',path:'getActiveClosureMapDataJSON.do',kind:'Agency-listed closure or plan'}
]){
  const url=`https://chartexp1.sha.maryland.gov/CHARTExportClientService/${feed.path}`;
  try{
    const data=await get(url);
    if(!Array.isArray(data.data))throw Error('Invalid Maryland CHART road feed');
    let count=0;
    for(const item of data.data){
      const lat=Number(item.lat),lon=Number(item.lon);
      if(!item.id||!Number.isFinite(lat)||!Number.isFinite(lon)||item.closed===true)continue;
      const sourceRecordDate=Number.isFinite(item.lastCachedDataUpdateTime)&&item.lastCachedDataUpdateTime>0?new Date(item.lastCachedDataUpdateTime).toISOString():null;
      records.push({id:`${feed.id}-${item.id}`,agency:'Maryland CHART',kind:feed.kind,name:item.name||item.description||'Unnamed road event',detail:[item.incidentType,item.lanesStatus,item.trafficAlertTextMsg].filter(Boolean).join(' · '),lat,lon,startAt:null,endAt:null,sourceUrl:url,sourceRecordDate,sourceReportedBy:item.source||null,sourcePlanned:item.planned===true,trafficAlert:item.trafficAlert===true});
      count++;
    }
    sources.push({id:feed.id,url,status:'ok',records:count});
  }catch(error){sources.push({id:feed.id,url,status:'failed',error:String(error)})}
}
const ilLayer='https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/ClosureIncidents/FeatureServer/0';
try{
  const metadata=await get(`${ilLayer}?f=json`);
  const updated=Number(metadata.editingInfo?.dataLastEditDate);
  if(!Number.isFinite(updated)||updated<=0||updated>now+3600000||now-updated>86400000)throw Error('Illinois DOT layer update is missing or older than 24 hours');
  const params=new URLSearchParams({where:'1=1',geometry:'-87.9,41.6,-87.45,42.05',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'OBJECTID,ConstructionType,EndDate,ID,Location,StartDate,NearTown,County,ClosureType,St_Name,Direction',returnGeometry:'true',f:'json',resultRecordCount:'1000'});
  const data=await get(`${ilLayer}/query?${params}`);
  if(!Array.isArray(data.features)||data.exceededTransferLimit||data.error)throw Error('Incomplete Illinois DOT closure/incident feed');
  let count=0;
  for(const feature of data.features){
    const p=feature.attributes||{},lat=Number(feature.geometry?.y),lon=Number(feature.geometry?.x),start=Number(p.StartDate),end=Number(p.EndDate);
    if(!Number.isInteger(p.OBJECTID)||!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<=start||start>seasonEnd||end<now)continue;
    records.push({id:`idot-closure-${p.OBJECTID}`,agency:'Illinois DOT',kind:'IDOT-listed closure/incident',name:p.Location||p.St_Name||'Unnamed road record',detail:[p.ConstructionType,p.ClosureType,p.Direction].filter(Boolean).join(' · '),lat,lon,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),sourceUrl:ilLayer,sourceRecordDate:null});
    count++;
  }
  sources.push({id:'idot-closure-incidents',url:ilLayer,status:'ok',records:count,sourceUpdatedAt:new Date(updated).toISOString()});
}catch(error){sources.push({id:'idot-closure-incidents',url:ilLayer,status:'failed',error:String(error)})}
if(sources.every(source=>source.status==='failed'))throw Error('Every public road condition source failed');
const available=new Set(sources.filter(source=>source.status==='ok').map(source=>source.id));
const byVenue=Object.fromEntries(venues.filter(venue=>venue.address.includes('CA, USA')?available.has('caltrans-lcs-d4')||available.has('caltrans-lcs-d7'):venue.address.includes('WA, USA')?available.has('wsdot-road-alerts'):venue.address.includes('MD, USA')?available.has('md-chart-incidents')||available.has('md-chart-closures'):available.has('idot-closure-incidents')).map(venue=>{
  const agency=venue.address.includes('CA, USA')?'Caltrans':venue.address.includes('WA, USA')?'WSDOT':venue.address.includes('MD, USA')?'Maryland CHART':'Illinois DOT';
  return [venue.id,records.filter(record=>record.agency===agency).map(record=>({...record,distanceKm:Math.round(km(venue.lat,venue.lon,record.lat,record.lon)*10)/10})).filter(record=>record.distanceKm<=10).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,50)];
}));
const timedCoverageByVenue=Object.fromEntries(venues.filter(venue=>venue.address.includes('IL, USA')&&Object.hasOwn(byVenue,venue.id)).map(venue=>[venue.id,{from:new Date(now).toISOString(),through:new Date(seasonEnd).toISOString(),basis:'Illinois DOT published closure windows from a layer updated within 24 hours; each record remains unverified for venue impact.'}]));
await fs.writeFile('site/roads.json',JSON.stringify({builtAt:new Date().toISOString(),coverageFrom:new Date(now).toISOString(),coverageThrough:new Date(horizon).toISOString(),timedCoverageByVenue,basis:'Agency-listed road conditions within 10 km of an unreviewed venue point; Caltrans published windows are compared for kickoffs within the next seven days, and Illinois DOT published windows through the listed NFL season when its layer edit is within 24 hours. Maryland CHART and WSDOT entries are source-listed observations or plans without a reliable event-time window. Proximity or time overlap does not establish travel impact, event relevance, or a threat.',sources,byVenue}));
console.log('Road condition sources:',sources.map(source=>`${source.id} ${source.status} ${source.records||0}`).join(', '),'venue matches:',Object.values(byVenue).map(items=>items.length).join(','));
