import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectCameraCoverage} from '../lib/camera_coverage.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=path.join(root,'site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
const venues=[...new Map(schedule.games.map(game=>[game.venue.id,game.venue])).values()]
  .filter(venue=>Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)&&/\b(CA|WA|MD|IL|WI|PA|GA), USA$/.test(venue.address));
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
      const stillUrl=item.imageData?.static?.currentImageURL;
      const allowedStill=typeof stillUrl==='string'&&new RegExp(`^https://cwwp2\\.dot\\.ca\\.gov/data/d${district}/cctv/image/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\\.jpg$`).test(stillUrl);
      cameras.push({id:`caltrans-${district}-${item.index}`,agency:'Caltrans',name:item.location?.locationName||'Road camera',lat,lon,route:item.location?.route||null,inService:item.inService==='true',metadataDate:/^\d{4}-\d\d-\d\d$/.test(recordDate||'')?recordDate:null,sourceUrl:url,viewerUrl:'https://quickmap.dot.ca.gov/',...(allowedStill?{stillUrl}:{} )});
      count++;
    }
    sources.push({id:`caltrans-d${district}`,url,status:'ok',records:count});
  }catch(error){sources.push({id:`caltrans-d${district}`,url,status:'failed',error:String(error)})}
}
const wsdot='https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoCamerasWeather/FeatureServer/0/query';
try{
  const params=new URLSearchParams({where:'1=1',geometry:'-122.55,47.35,-122.05,47.85',geometryType:'esriGeometryEnvelope',inSR:'4326',outFields:'OBJECTID,CameraTitle,CompassDirection,ImageURL',returnGeometry:'true',f:'geojson',resultRecordCount:'2000'});
  const data=await get(`${wsdot}?${params}`);
  if(!Array.isArray(data.features)||data.features.length<20||data.exceededTransferLimit||data.properties?.exceededTransferLimit)throw Error('Incomplete Seattle-area inventory');
  let count=0;
  for(const feature of data.features){
    const [lon,lat]=feature.geometry?.coordinates||[];
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isInteger(feature.properties?.OBJECTID))continue;
    const stillUrl=feature.properties.ImageURL;
    const allowedStill=typeof stillUrl==='string'&&/^https:\/\/images\.wsdot\.wa\.gov\/[a-z0-9_-]+\/[a-z0-9_-]+\.jpg$/i.test(stillUrl);
    cameras.push({id:`wsdot-${feature.properties.OBJECTID}`,agency:'WSDOT',name:feature.properties.CameraTitle||'Road camera',lat,lon,route:null,inService:null,metadataDate:null,sourceUrl:wsdot.replace(/\/query$/,''),viewerUrl:'https://wsdot.com/travel/real-time/',...(allowedStill?{stillUrl}:{} )});
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
if(sources.find(source=>source.id==='md-chart-cameras')?.status==='failed'){
  const imap='https://mdgeodata.md.gov/imap/rest/services/Transportation/MD_TrafficCameras/FeatureServer/0';
  try{
    const params=new URLSearchParams({where:'1=1',outFields:'OBJECTID,location,county,feedID,url,lat,long',returnGeometry:'false',f:'json',resultRecordCount:'550'});
    const data=await get(`${imap}/query?${params}`);
    if(!Array.isArray(data.features)||data.features.length<300||data.error||data.exceededTransferLimit)throw Error('Incomplete Maryland iMAP camera inventory');
    let count=0;
    for(const feature of data.features){
      const item=feature.attributes||{},lat=Number(item.lat),lon=Number(item.long);
      if(!Number.isInteger(item.OBJECTID)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<37.8||lat>39.8||lon< -79.6||lon> -75||!/^[a-f0-9]{32}$/i.test(item.feedID||''))continue;
      const viewerUrl=item.url;
      if(typeof viewerUrl!=='string'||!new RegExp(`^https://chart\\.maryland\\.gov/video/video\\.php\\?feed=${item.feedID}$`,'i').test(viewerUrl))continue;
      cameras.push({id:`md-imap-${item.OBJECTID}`,agency:'Maryland CHART',name:item.location||'Road camera',lat,lon,route:null,inService:null,operationalStatus:'Agency inventory; live status unverified',statusAsOf:null,metadataDate:null,sourceUrl:imap,viewerUrl});
      count++;
    }
    if(count<300)throw Error('Insufficient valid Maryland iMAP camera records');
    sources.push({id:'md-imap-cameras',url:imap,status:'ok',records:count,upstreamFreshness:'unknown'});
  }catch(error){sources.push({id:'md-imap-cameras',url:imap,status:'failed',error:String(error)})}
}
const gaLayer='https://enterprisegis.dot.ga.gov/hosting/rest/services/web_trafficcameras/MapServer/0';
try{
  const params=new URLSearchParams({where:'1=1',geometry:'-84.5,33.7,-84.3,33.85',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'OBJECTID,DEVICE_ID,DEVICE_DESCRIPTION,ACTIVE,PRIMARY_ROAD,CITY_NAME,URL,LATITUDE,LONGITUDE',returnGeometry:'true',f:'json',resultRecordCount:'1000'});
  const data=await get(`${gaLayer}/query?${params}`);
  if(!Array.isArray(data.features)||data.features.length<100||data.error||data.exceededTransferLimit)throw Error('Incomplete Atlanta camera inventory');
  let count=0;
  for(const feature of data.features){
    const item=feature.attributes||{},lat=Number(item.LATITUDE),lon=Number(item.LONGITUDE),viewerUrl=item.URL;
    if(!Number.isInteger(item.OBJECTID)||item.ACTIVE!==1||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<33.6||lat>34||lon< -84.7||lon> -84.1)continue;
    if(typeof viewerUrl!=='string'||!/^https:\/\/snapshot\.navigator\.dot\.ga\.gov\/thumbs\/[A-Za-z0-9_.-]+\.png$/.test(viewerUrl))continue;
    cameras.push({id:`gdot-${item.OBJECTID}`,agency:'Georgia DOT GIS',name:item.DEVICE_DESCRIPTION||item.PRIMARY_ROAD||'Road camera',lat,lon,route:item.PRIMARY_ROAD||null,inService:null,operationalStatus:'Listed active in agency inventory; image status unverified',metadataDate:null,sourceUrl:gaLayer,viewerUrl,viewerKind:'unverified_still'});
    count++;
  }
  if(count<100)throw Error('Insufficient valid Atlanta camera records');
  sources.push({id:'gdot-atlanta-cameras',url:gaLayer,status:'ok',records:count,upstreamFreshness:'unknown'});
}catch(error){sources.push({id:'gdot-atlanta-cameras',url:gaLayer,status:'failed',error:String(error)})}
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
const paLayer='https://gis.penndot.gov/gis/rest/services/paprojects/paprojects/MapServer/14';
try{
  let count=0;
  for(const bbox of ['-75.3,39.85,-74.95,40.1','-80.15,40.35,-79.8,40.55']){
    const params=new URLSearchParams({where:"STATUS_NAME='EXISTING'",geometry:bbox,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'ID,STATEWIDE_ID,STATUS_NAME,LOCATION_DESC,RECORD_UPDATE',returnGeometry:'true',f:'json',resultRecordCount:'1000'});
    const data=await get(`${paLayer}/query?${params}`);
    if(!Array.isArray(data.features)||data.features.length<50||data.error||data.exceededTransferLimit)throw Error('Incomplete PennDOT camera inventory');
    for(const feature of data.features){
      const p=feature.attributes||{},lat=Number(feature.geometry?.y),lon=Number(feature.geometry?.x),updated=Number(p.RECORD_UPDATE);
      if(!Number.isInteger(p.ID)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<39.7||lat>40.7||lon< -80.3||lon> -74.8||p.STATUS_NAME!=='EXISTING')continue;
      cameras.push({id:`penndot-${p.ID}`,agency:'PennDOT GIS',name:p.LOCATION_DESC||'Road camera',lat,lon,route:null,inService:null,operationalStatus:'Existing in agency inventory',metadataDate:Number.isFinite(updated)&&updated>0?new Date(updated).toISOString().slice(0,10):null,sourceUrl:paLayer,viewerUrl:'https://511pa.com/cctv'});
      count++;
    }
  }
  if(count<100)throw Error('Insufficient valid PennDOT camera records');
  sources.push({id:'penndot-camera-inventory',url:paLayer,status:'ok',records:count});
}catch(error){sources.push({id:'penndot-camera-inventory',url:paLayer,status:'failed',error:String(error)})}
if(sources.every(source=>source.status==='failed'))throw Error('Every public camera metadata source failed');
const byVenue=selectCameraCoverage(venues,cameras,sources);
const out={builtAt:new Date().toISOString(),basis:'Public roadway camera metadata within 15 km of unreviewed venue point; distance does not establish a view of the venue, image freshness, or operational status.',sources,byVenue};
await fs.writeFile(path.join(site,'cameras.json'),JSON.stringify(out));
console.log('Camera metadata sources:',sources.map(source=>`${source.id} ${source.status} ${source.records||0}`).join(', '),'venue matches:',Object.values(byVenue).map(items=>items.length).join(','));
