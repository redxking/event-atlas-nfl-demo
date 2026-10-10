import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {denverCrimeLayer,denverCrimeQueries,summarizeDenverCrimes} from '../site/denver_public_safety.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'site/denver_public_safety.json');
const schedule=JSON.parse(await fs.readFile(path.join(root,'site/nfl.json'),'utf8'));
const venue=schedule.games.find(game=>game.venue.id==='3937')?.venue;
if(!venue)throw Error('Empower Field at Mile High is absent from the current NFL snapshot');
const checkedAt=Date.now(),query=denverCrimeQueries(venue,checkedAt);
const read=async url=>{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 public source connector'},signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()};
let status='error',context=null,error=null;
try{
  const metadata=await read(`${denverCrimeLayer}?f=json`);
  const fields=new Set(metadata?.fields?.map(field=>field.name));
  if(metadata?.name!=='CRIME_OFFENSES_P'||metadata?.geometryType!=='esriGeometryPoint'||!fields.has('REPORTED_DATE')||!fields.has('IS_CRIME'))throw Error('Denver source identity or schema changed');
  const count=await read(query.countUrl);
  const latest=await read(query.latestUrl);
  context=summarizeDenverCrimes(count,latest,query,checkedAt);
  status=context.status==='delayed_historical'?'ok':'stale_source';
}catch(cause){error=String(cause?.message||cause).slice(0,200)}
const output={builtAt:new Date(checkedAt).toISOString(),status,sourceId:'denver-open-data-crime-offenses',sourceUrl:denverCrimeLayer,scope:'Empower Field at Mile High candidate point, 5 km radius, 30 UTC days ending seven days before the current UTC day',basis:'Count-only spatial query of records flagged as crime in Denver Open Data; separate latest citywide report date checks publisher lag.',caution:'Delayed historical, geocoded reported-offense count. No individual IDs, addresses, categories, people or coordinates retained. Not an active police alert, stadium incident, trend or threat finding. Publisher completeness and candidate stadium point are unverified.',byVenue:context?{'3937':context}:{},error};
await fs.writeFile(out+'.tmp',JSON.stringify(output)+'\n');
await fs.rename(out+'.tmp',out);
console.log(JSON.stringify({status,venueId:'3937',nearby:context?.nearby??null,sourceLagHours:context?.sourceLagHours??null,error}));
