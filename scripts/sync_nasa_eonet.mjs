import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildEonetNflSnapshot,eonetSourceUrl} from '../site/eonet_nfl.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const now=Date.now();
let snapshot;
try{
  const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
  if(schedule?.source?.status!=='ok'||!Array.isArray(schedule.games))throw Error('NFL schedule unavailable');
  let response;
  for(let attempt=0;attempt<3;attempt++){
    try{response=await fetch(eonetSourceUrl,{headers:{Accept:'application/geo+json, application/json','User-Agent':'EventAtlas NFL public natural-event context (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(15000)});
      if(response.status!==429&&response.status<500)break;
      if(attempt===2)break;
      await response.body?.cancel();
    }catch(error){if(attempt===2)throw error;}
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
  if(!response.ok||new URL(response.url).hostname!=='eonet.gsfc.nasa.gov')throw Error(`Unexpected NASA EONET response ${response.status}`);
  const body=await response.text();
  if(body.length>5000000)throw Error('NASA EONET response exceeds size limit');
  snapshot=buildEonetNflSnapshot(JSON.parse(body),schedule.games,now);
}catch(error){snapshot={schema:'event-atlas.eonet-nfl.v1',status:'failed',builtAt:new Date(now).toISOString(),sourceUrl:eonetSourceUrl,byVenue:{},error:String(error.message).slice(0,160)}}
await fs.writeFile(path.join(site,'eonet.json'),JSON.stringify(snapshot)+'\n','utf8');
console.log(`NASA EONET NFL: ${snapshot.status}; ${Object.keys(snapshot.byVenue).length} venues with recent regional point context`);
