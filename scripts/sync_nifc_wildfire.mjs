import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildNifcSnapshot,nifcLayer,nifcSource} from '../site/nifc_wildfire.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site'),now=Date.now();
let snapshot;
try{
  const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
  if(schedule?.source?.status!=='ok'||!Array.isArray(schedule.games))throw Error('NFL schedule unavailable');
  const url=new URL(`${nifcLayer}/query`);
  for(const [key,value] of Object.entries({where:"IncidentTypeCategory = 'WF'",outFields:'OBJECTID,IncidentName,IncidentTypeCategory,IncidentSize,FireDiscoveryDateTime,ModifiedOnDateTime_dt,FireOutDateTime,PercentContained',returnGeometry:'true',outSR:'4326',f:'json'}))url.searchParams.set(key,value);
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas NFL public wildfire context (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(25000)});
  if(!response.ok||new URL(response.url).hostname!=='services3.arcgis.com')throw Error(`Unexpected NIFC response ${response.status}`);
  const body=await response.text();
  if(body.length>3000000)throw Error('NIFC response exceeds size limit');
  snapshot=buildNifcSnapshot(JSON.parse(body),schedule.games,now);
}catch(error){snapshot={schema:'event-atlas.nifc-wildfire.v1',status:'failed',builtAt:new Date(now).toISOString(),sourceUrl:nifcSource,sourceLayer:nifcLayer,byVenue:{},error:String(error.message).slice(0,160)}}
await fs.writeFile(path.join(site,'nifc_wildfire.json'),JSON.stringify(snapshot)+'\n','utf8');
console.log(`NIFC wildfire: ${snapshot.status}; ${Object.keys(snapshot.byVenue).length} venues with nearby recent points`);
