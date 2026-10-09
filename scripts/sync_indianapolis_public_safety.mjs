import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {indianapolisCfsLayer,indianapolisCfsQueries,summarizeIndianapolisCfs} from '../site/indianapolis_public_safety.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'site/indianapolis_public_safety.json');
const schedule=JSON.parse(await fs.readFile(path.join(root,'site/nfl.json'),'utf8'));
const venue=schedule.games.find(game=>game.venue.id==='3812')?.venue;
if(!venue)throw Error('Lucas Oil Stadium is absent from the current NFL snapshot');
const checkedAt=Date.now(),query=indianapolisCfsQueries(venue,checkedAt);
const read=async url=>{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 public source connector'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()};
let status='error',context=null,error=null;
try{
  const [count,latest]=await Promise.all([read(query.countUrl),read(query.latestUrl)]);
  context=summarizeIndianapolisCfs(count,latest,query,checkedAt);
  status=context.status==='delayed_historical'?'ok':'stale_source';
}catch(cause){error=String(cause?.message||cause).slice(0,200)}
const output={builtAt:new Date(checkedAt).toISOString(),status,sourceId:'impd-cfs-public',sourceUrl:indianapolisCfsLayer,scope:'Lucas Oil Stadium candidate point, 5 km radius, seven UTC days ending at the start of the preceding UTC day',basis:'Count-only spatial query of IMPD public calls for service; a separate citywide maximum record timestamp checks publisher lag.',caution:'Delayed historical call count only. No individual calls, identifiers, addresses, types or coordinates retained. Not a current police alert, stadium incident, risk trend or threat finding.',byVenue:context?{'3812':context}:{},error};
const temporary=out+'.tmp';
await fs.writeFile(temporary,JSON.stringify(output)+'\n');
await fs.rename(temporary,out);
console.log(JSON.stringify({status,venueId:'3812',nearby:context?.nearby??null,sourceLagHours:context?.sourceLagHours??null,error}));
