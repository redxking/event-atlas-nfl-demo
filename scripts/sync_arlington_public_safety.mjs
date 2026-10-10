import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {arlingtonPoliceLayer,arlingtonAggregateQueries,summarizeArlingtonAggregate} from '../site/arlington_police_aggregate.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'site/arlington_public_safety.json');
const schedule=JSON.parse(await fs.readFile(path.join(root,'site/nfl.json'),'utf8'));
const venue=schedule.games.find(game=>game.venue.id==='3687')?.venue;
if(!venue)throw Error('AT&T Stadium is absent from the current NFL snapshot');
const checkedAt=Date.now(),queries=arlingtonAggregateQueries(venue);
const read=async url=>{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 public source connector'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()};
let status='error',context=null,error=null;
try{
  const [count,latest]=await Promise.all([read(queries.countUrl),read(queries.latestUrl)]);
  context=summarizeArlingtonAggregate(count,latest,checkedAt);
  status='ok';
}catch(cause){error=String(cause?.message||cause).slice(0,200)}
const output={builtAt:new Date(checkedAt).toISOString(),status,sourceId:'arlington-public-active-incidents-aggregate',sourceUrl:arlingtonPoliceLayer,viewerUrl:'https://policeincidents.arlingtontx.gov/',scope:'AT&T Stadium candidate point, 5 km radius; publisher-visible calls only',basis:'Count-only spatial ArcGIS query; a separate citywide latest-update query checks feed currency.',caution:'City public calls are delayed at least 60 minutes and refreshed on a 15-minute cycle. The count is not a current police alert, a stadium incident, a trend, or a threat finding. No incident identities, addresses, categories or coordinates are retained.',byVenue:context?{'3687':context}:{},error};
await fs.writeFile(out+'.tmp',JSON.stringify(output)+'\n');
await fs.rename(out+'.tmp',out);
console.log(JSON.stringify({status,venueId:'3687',nearby:context?.nearby??null,sourceLagMinutes:context?.sourceLagMinutes??null,error}));
