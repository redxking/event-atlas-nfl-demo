import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=path.join(root,'site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
const venues=[...new Map(schedule.games.map(game=>[game.venue.id,game.venue])).values()]
  .filter(venue=>Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)&&/\b(CA|WA|MD|IL|WI), USA$/.test(venue.address));
const km=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};
const sources=[];
const cameras=[];
async function get(url){const response=await fetch(url,{headers:{'User-Agent':'EventAtlas/0.4 public-road-camera-metadata'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()}
for(const district of [4,7]){
  const suffix=String(district).padStart(2,'0');
  const url=`https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${suffix}.json`;
  try{
    const data=await get(url);
    if(!Array.isArray(data.data)||data.data.length<100)throw Error('Incomplete district inventory');
    let count=0;
    for(const entry of data.data){
      const item=entry.cctv,lat=Number(item?.location?.latitude),lon=Number(item?.location?.longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<32||lat>42||lon< -125||lon> -114)continue;
      const recordDate=item.recordTimestamp?.recordDate;
      cameras.push({id:`caltrans-${district}-${item.index}`,agency:'Caltrans',name:item.location?.locationName||'Road camera',lat,lon,route:item.location?.route||null,inService:item.inService==='true',metadataDate:/^\d{4}-\d\d-\d\d$/.test(recordDate||'')?recordDate:null,sourceUrl:url,viewerUrl:'https://quickmap.dot.ca.gov/'});
      count++;
    }
    sources.push({id:`caltrans-d${district}`,url,status:'ok',records:count});
  }catch(error){sources.push({id:`caltrans-d${district}`,url,status:'failed',error:String(error)})}
}
const wsdot='https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoCamerasWeather/FeatureServer/0/query';
try{
  const params=new URLSearchParams({where:'1=1',geometry:'-122.55,47.35,-122.05,47.85',geometryType:'esriGeometryEnvelope',inSR:'4326',outFields:'OBJECTID,CameraTitle,CompassDirection',returnGeometry:'true',f:'geojson',resultRecordCount:'2000'});
  const data=await get(`${wsdot}?${params}`);
  if(!Array.isArray(data.features)||data.features.length<20||data.exceededTransferLimit||data.properties?.exceededTransferLimit)throw Error('Incomplete Seattle-area inventory');
  let count=0;
  for(const feature of data.features){
    const [lon,lat]=feature.geometry?.coordinates||[];
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isInteger(feature.properties?.OBJECTID))continue;
    cameras.push({id:`wsdot-${feature.properties.OBJECTID}`,agency:'WSDOT',name:feature.properties.CameraTitle||'Road camera',lat,lon,route:null,inService:null,metadataDate:null,sourceUrl:wsdot.replace(/\/query$/,''),viewerUrl:'https://wsdot.com/travel/real-time/'});
    count++;
  }
  sources.push({id:'wsdot-seattle',url:wsdot,status:'ok',records:count});
}catch(error){sources.push({id:'wsdot-seattle',url:wsdot,status:'failed',error:String(error)})}
const mdUrl='https://chart.maryland.gov/DataFeeds/GetCamerasJson';
try{
  const data=await get(mdUrl);
  if(!Array.isArray(data)||data.length<300)throw Error('Incomplete Maryland camera inventory');
  let count=0;
  for(const item of data){
    const lat=Number(item.lat),lon=Number(item.lon);
    if(!/^[a-f0-9]{32}$/i.test(item.id||'')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<37.8||lat>39.8||lon< -79.6||lon> -75)continue;
    const viewerUrl=item.publicVideoURL;
    if(typeof viewerUrl!=='string'||!new RegExp(`^https://chart\\.maryland\\.gov/Video/GetVideo/${item.id}$`,'i').test(viewerUrl))continue;
    cameras.push({id:`md-chart-${item.id}`,agency:'Maryland CHART',name:item.description||item.name||'Road camera',lat,lon,route:[item.routePrefix,item.routeNumber].filter(Boolean).join(' ')||null,inService:item.opStatus==='OK',operationalStatus:item.opStatus||null,statusAsOf:Number.isFinite(item.lastCachedDataUpdateTime)?new Date(item.lastCachedDataUpdateTime).toISOString():null,metadataDate:null,sourceUrl:mdUrl,viewerUrl});
    count++;
  }
  sources.push({id:'md-chart-cameras',url:mdUrl,status:'ok',records:count});
}catch(error){sources.push({id:'md-chart-cameras',url:mdUrl,status:'failed',error:String(error)})}
const ilLayer='https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0';
try{
  const params=new URLSearchParams({where:'1=1',geometry:'-87.9,41.65,-87.45,42.1',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'OBJECTID,CameraLocation,CameraDirection,ImgPath',returnGeometry:'true',f:'json',resultRecordCount:'1000'});
  const data=await get(`${ilLayer}/query?${params}`);
  if(!Array.isArray(data.features)||data.features.length<20||data.exceededTransferLimit)throw Error('Incomplete Chicago-area camera inventory');
  let count=0;
  for(const feature of data.features){
    const item=feature.attributes||{},lat=Number(feature.geometry?.y),lon=Number(feature.geometry?.x);
    if(!Number.isInteger(item.OBJECTID)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<41.5||lat>42.2||lon< -88.2||lon> -87.2)continue;
    const viewer=item.ImgPath;
    if(typeof viewer!=='string'||!/^https:\/\/(?:www\.)?travelmidwest\.com\/showCamera\?/i.test(viewer))continue;
    cameras.push({id:`idot-gateway-${item.OBJECTID}`,agency:'Illinois DOT Gateway',name:item.CameraLocation||'Road camera',lat,lon,route:null,inService:null,metadataDate:null,sourceUrl:ilLayer,viewerUrl:viewer});
    count++;
  }
  sources.push({id:'idot-gateway-chicago',url:ilLayer,status:'ok',records:count});
}catch(error){sources.push({id:'idot-gateway-chicago',url:ilLayer,status:'failed',error:String(error)})}
const wiLayer='https://services5.arcgis.com/0pgGLzT0Nh7FVjon/ArcGIS/rest/services/511_Camera_Public/FeatureServer/0';
try{
  const params=new URLSearchParams({where:'1=1',geometry:'-88.3,44.3,-87.8,44.7',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'OBJECTID,Id,Roadway,Direction,Location,ViewsUrl,ViewsStatus',returnGeometry:'true',f:'json',resultRecordCount:'1000'});
  const data=await get(`${wiLayer}/query?${params}`);
  if(!Array.isArray(data.features)||data.features.length<10||data.exceededTransferLimit)throw Error('Incomplete Green Bay-area camera inventory');
  let count=0;
  for(const feature of data.features){
    const item=feature.attributes||{},lat=Number(feature.geometry?.y),lon=Number(feature.geometry?.x);
    if(!Number.isInteger(item.OBJECTID)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<44.2||lat>44.8||lon< -88.4||lon> -87.7)continue;
    const viewer=item.ViewsUrl;
    if(typeof viewer!=='string'||!/^https:\/\/511wi\.gov\/map\/Cctv\/\d+$/i.test(viewer))continue;
    cameras.push({id:`wisdot-511-${item.OBJECTID}`,agency:'WisDOT 511',name:item.Location||'Road camera',lat,lon,route:item.Roadway||null,inService:null,operationalStatus:item.ViewsStatus||null,metadataDate:null,sourceUrl:wiLayer,viewerUrl:viewer});
    count++;
  }
  if(count<10)throw Error('Insufficient valid Green Bay-area camera records');
  sources.push({id:'wisdot-511-green-bay',url:wiLayer,status:'ok',records:count});
}catch(error){sources.push({id:'wisdot-511-green-bay',url:wiLayer,status:'failed',error:String(error)})}
if(sources.every(source=>source.status==='failed'))throw Error('Every public camera metadata source failed');
const byVenue=Object.fromEntries(venues.map(venue=>{
  const state=venue.address.match(/\b([A-Z]{2}), USA$/)?.[1];
  const agency={CA:'Caltrans',WA:'WSDOT',MD:'Maryland CHART',IL:'Illinois DOT Gateway',WI:'WisDOT 511'}[state];
  return [venue.id,cameras.filter(camera=>camera.agency===agency).map(camera=>({...camera,distanceKm:Math.round(km(venue.lat,venue.lon,camera.lat,camera.lon)*10)/10})).filter(camera=>camera.distanceKm<=15).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,5)];
}));
const out={builtAt:new Date().toISOString(),basis:'Public roadway camera metadata within 15 km of unreviewed venue point; distance does not establish a view of the venue, image freshness, or operational status.',sources,byVenue};
await fs.writeFile(path.join(site,'cameras.json'),JSON.stringify(out));
console.log('Camera metadata sources:',sources.map(source=>`${source.id} ${source.status} ${source.records||0}`).join(', '),'venue matches:',Object.values(byVenue).map(items=>items.length).join(','));
