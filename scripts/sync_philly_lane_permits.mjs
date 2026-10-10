import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {phillyLanePermitLayer,phillyLanePermitQuery,summarizePhillyLanePermits} from '../site/philly_lane_permits.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const schedule=JSON.parse(await fs.readFile(path.join(root,'site/nfl.json'),'utf8'));
const games=schedule.games.filter(game=>game.venue?.id==='3806');
const venue=games[0]?.venue;
if(!venue)throw Error('Lincoln Financial Field is absent from the current NFL snapshot');
const now=Date.now(),seasonEnd=Math.max(...games.map(game=>Date.parse(game.kickoff)).filter(Number.isFinite));
const read=async url=>{const response=await fetch(url,{headers:{Accept:'application/geo+json, application/json','User-Agent':'EventAtlas/0.4 public permit connector'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()};
let status='error',summary=null,error=null,sourceEditedAt=null;
try{
  const metadata=await read(`${phillyLanePermitLayer}?f=json`),fields=new Set(metadata?.fields?.map(field=>field.name));
  if(metadata?.name!=='LaneClosure_Master'||metadata?.geometryType!=='esriGeometryPolyline'||!['objectid','permitnumber','status','effectivedate','expirationdate'].every(field=>fields.has(field)))throw Error('Philadelphia permit source identity or schema changed');
  const edited=Number(metadata.editingInfo?.dataLastEditDate??metadata.editingInfo?.lastEditDate);
  if(!Number.isFinite(edited)||edited>now+3600000)throw Error('Philadelphia permit source edit time is invalid');
  sourceEditedAt=new Date(edited).toISOString();
  summary=summarizePhillyLanePermits(await read(phillyLanePermitQuery(venue,now,seasonEnd)),games,venue,now);
  status=now-edited<=14*86400000?'ok':'stale_source';
}catch(cause){error=String(cause?.message||cause).slice(0,200)}
const output={builtAt:new Date(now).toISOString(),status,sourceId:'phila-streets-lane-permits',sourceUrl:phillyLanePermitLayer,sourceEditedAt,scope:'Streets Department permitted road-work segments within 2 km of the Lincoln Financial Field candidate point; permit effective dates screened against each listed Eagles home-game calendar date',caution:'A permit authorizes work; it does not verify a lane is actually closed, a route is affected, work is active at kickoff, a stadium incident, or a threat. Permit dates have day precision only. Candidate venue point is unreviewed.',sourceSegments:summary?.sourceSegments??null,validSegments:summary?.validSegments??null,byGame:summary?.byGame||{},error};
const out=path.join(root,'site/philly_lane_permits.json');
await fs.writeFile(out+'.tmp',JSON.stringify(output)+'\n');await fs.rename(out+'.tmp',out);
console.log(JSON.stringify({status,sourceSegments:output.sourceSegments,games:Object.keys(output.byGame).length,first:Object.values(output.byGame)[0]?.permitCount??null,error}));
