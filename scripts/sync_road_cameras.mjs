import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=path.join(root,'site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
const venues=[...new Map(schedule.games.map(game=>[game.venue.id,game.venue])).values()]
  .filter(venue=>Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)&&/\b(CA|WA), USA$/.test(venue.address));
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
if(sources.every(source=>source.status==='failed'))throw Error('Every public camera metadata source failed');
const byVenue=Object.fromEntries(venues.map(venue=>{
  const agency=venue.address.includes('CA, USA')?'Caltrans':'WSDOT';
  return [venue.id,cameras.filter(camera=>camera.agency===agency).map(camera=>({...camera,distanceKm:Math.round(km(venue.lat,venue.lon,camera.lat,camera.lon)*10)/10})).filter(camera=>camera.distanceKm<=15).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,5)];
}));
const out={builtAt:new Date().toISOString(),basis:'Public roadway camera metadata within 15 km of unreviewed venue point; distance does not establish a view of the venue, image freshness, or operational status.',sources,byVenue};
await fs.writeFile(path.join(site,'cameras.json'),JSON.stringify(out));
console.log('Camera metadata sources:',sources.map(source=>`${source.id} ${source.status} ${source.records||0}`).join(', '),'venue matches:',Object.values(byVenue).map(items=>items.length).join(','));
