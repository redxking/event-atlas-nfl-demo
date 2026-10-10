import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {airnowQueryUrl,airnowDocs,buildAirnowSnapshot} from '../site/airnow_pm25.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site'),now=Date.now(),sourceUrl=airnowQueryUrl(now);
let snapshot;
try{
  const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
  if(schedule?.source?.status!=='ok'||!Array.isArray(schedule.games))throw Error('NFL schedule unavailable');
  const response=await fetch(sourceUrl,{headers:{Accept:'text/plain','User-Agent':'EventAtlas NFL public air-quality context (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(30000)});
  if(!response.ok||new URL(response.url).hostname!=='ofmpub.epa.gov')throw Error(`Unexpected EPA RSIG response ${response.status}`);
  const body=await response.text();
  snapshot=buildAirnowSnapshot(body,schedule.games,sourceUrl,now);
}catch(error){snapshot={schema:'event-atlas.airnow-pm25.v1',status:'failed',builtAt:new Date(now).toISOString(),sourceUrl,docsUrl:airnowDocs,byVenue:{},error:String(error.message).slice(0,160)}}
await fs.writeFile(path.join(site,'airnow_pm25.json'),JSON.stringify(snapshot)+'\n','utf8');
console.log(`EPA AirNow PM2.5: ${snapshot.status}; ${Object.keys(snapshot.byVenue).length} venues with recent nearby station readings`);
