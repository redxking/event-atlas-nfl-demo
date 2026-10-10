import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {glendaleCallsLayer,glendaleCallsQueries,summarizeGlendaleCalls} from '../site/glendale_public_calls.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'site/glendale_public_calls.json');
const schedule=JSON.parse(await fs.readFile(path.join(root,'site/nfl.json'),'utf8'));
if(!schedule.games?.some(game=>game.venue.id==='3970'))throw Error('State Farm Stadium is absent from the current NFL snapshot');
const checkedAt=Date.now(),query=glendaleCallsQueries(checkedAt);
const read=async url=>{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 public source connector'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()};
let status='error',context=null,error=null;
try{
  const [count,latest]=await Promise.all([read(query.countUrl),read(query.latestUrl)]);
  context=summarizeGlendaleCalls(count,latest,query,checkedAt);
  status=context.status==='delayed_historical'?'ok':'stale_source';
}catch(cause){error=String(cause?.message||cause).slice(0,200)}
const output={builtAt:new Date(checkedAt).toISOString(),status,sourceId:'glendale-police-cfs-public',sourceUrl:glendaleCallsLayer,scope:'Glendale Police public calls-for-service table, stadium-address ZIP 85305, seven UTC days ending two UTC days before check',basis:'Count-only query by ZIP and source call time; separate citywide maximum call and load timestamps check publisher lag. ZIP 85305 is broader than the stadium and is not a radius.',caution:'Delayed historical ZIP count only. No individual calls, identifiers, addresses, types or coordinates retained. Not a current police alert, stadium incident, risk trend or threat finding.',byVenue:context?{'3970':context}:{},error};
const temporary=out+'.tmp';
await fs.writeFile(temporary,JSON.stringify(output)+'\n');
await fs.rename(temporary,out);
console.log(JSON.stringify({status,venueId:'3970',zip:query.zip,count:context?.nearby??null,sourceLagHours:context?.sourceLagHours??null,error}));
