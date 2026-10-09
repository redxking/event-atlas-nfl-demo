import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=path.join(root,'site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
const source='https://services1.arcgis.com/n4Ot9Qz0t5espY4s/arcgis/rest/services/SEAMS_Production_View/FeatureServer/0';
const url=`${source}/query?`+new URLSearchParams({where:"LEAGUE_NAME='NFL'",outFields:'OBJECTID,GAME_DETAIL_ID,EVENT_NAME,VENUE,GAME_DATE,END_DATE,STATUS,IS_ACTIVE,updatedAt',returnGeometry:'true',outSR:'4326',f:'geojson',resultRecordCount:'1000'});
let data;
try{
  const response=await fetch(url,{headers:{'User-Agent':'EventAtlas/0.4 FAA-SEAMS-public-data'},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error(`FAA SEAMS HTTP ${response.status}`);
  data=await response.json();
  if(!Array.isArray(data.features)||data.features.length>=1000||data.exceededTransferLimit)throw Error('FAA SEAMS NFL response incomplete');
}catch(error){
  const retained=JSON.parse(await fs.readFile(path.join(site,'seams.json'),'utf8').catch(()=>'null'));
  if(!retained?.builtAt||!retained?.byGame||retained.sourceUrl!==source)throw Error(`FAA SEAMS refresh failed and no valid previous snapshot exists: ${error.message}`);
  console.warn(`FAA SEAMS refresh failed (${error.message}); retained previous snapshot from ${retained.builtAt}. It remains stale until a successful source refresh.`);
  process.exit(0);
}
const normalize=value=>String(value||'').toLowerCase().replace(/\s+@\s+/g,' at ').replace(/[^a-z0-9]+/g,' ').trim();
const games=new Map(schedule.games.map(game=>[normalize(game.title),game]));
const byGame={};let unmatched=0;
for(const feature of data.features){
  const p=feature.properties||{},game=games.get(normalize(p.EVENT_NAME));
  if(!game){unmatched++;continue}
  const ring=feature.geometry?.coordinates?.[0];
  if(feature.geometry?.type!=='Polygon'||!Array.isArray(ring)||ring.length<24||ring.length>100||!ring.every(point=>Array.isArray(point)&&point.length===2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&point[0]>=-126&&point[0]<=-65&&point[1]>=24&&point[1]<=50)||!Number.isInteger(p.OBJECTID)||!Number.isFinite(p.GAME_DATE)||!Number.isFinite(p.END_DATE))continue;
  const startAt=new Date(p.GAME_DATE).toISOString(),endAt=new Date(p.END_DATE).toISOString();
  if(Math.abs(p.GAME_DATE-Date.parse(game.kickoff)+3600000)>60000||p.END_DATE<=p.GAME_DATE)continue;
  const points=ring.slice(0,-1),lon=points.reduce((sum,point)=>sum+point[0],0)/points.length,lat=points.reduce((sum,point)=>sum+point[1],0)/points.length;
  const separationKm=111.2*Math.hypot(lat-game.venue.lat,(lon-game.venue.lon)*Math.cos(lat*Math.PI/180));
  if(!Number.isFinite(separationKm)||separationKm>1)continue;
  byGame[game.id]={objectId:p.OBJECTID,sourceGameId:p.GAME_DETAIL_ID,eventName:p.EVENT_NAME,venueName:p.VENUE,startAt,endAt,status:p.STATUS,isActive:p.IS_ACTIVE===1,sourceUpdatedAt:Number.isFinite(p.updatedAt)?new Date(p.updatedAt).toISOString():null,center:{lat:Math.round(lat*1e6)/1e6,lon:Math.round(lon*1e6)/1e6},ring:ring.map(([x,y])=>[Math.round(x*1e6)/1e6,Math.round(y*1e6)/1e6])};
}
const matched=Object.keys(byGame).length;
const out={builtAt:new Date().toISOString(),sourceUrl:source,sourceItemUrl:'https://faasysops.maps.arcgis.com/home/item.html?id=9f246af52c4049b99b50a2b97e2e5b2c',basis:'FAA SEAMS public informational sporting-event airspace layer. Match requires exact matchup, start one hour before listed kickoff, and center within 1 km of unreviewed venue candidate point. Verify current status and NOTAM before operational use.',records:data.features.length,matched,unmatched,unlinked:data.features.length-matched,byGame};
await fs.writeFile(path.join(site,'seams.json'),JSON.stringify(out));
console.log(`FAA SEAMS NFL ${out.records} records; ${out.matched} matched, ${unmatched} unmatched`);
