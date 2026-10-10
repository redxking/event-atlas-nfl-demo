import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {njTransitRailFeed,summarizeNjTransitRailFeed} from '../site/njtransit_event_rail.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
if(schedule?.source?.status!=='ok'||!Array.isArray(schedule.games)||Date.now()-Date.parse(schedule.builtAt)>12*3600000)throw Error('Fresh NFL schedule required');
const output=path.join(site,'njtransit_event_rail.json'),temporary=output+'.tmp';
let snapshot;
try{
  const response=await fetch(njTransitRailFeed,{headers:{Accept:'application/rss+xml, application/xml','User-Agent':'EventAtlas-NFL-Demo/0.4'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`NJ TRANSIT HTTP ${response.status}`);
  snapshot=summarizeNjTransitRailFeed(await response.text(),schedule.games);
}catch(error){
  const previous=JSON.parse(await fs.readFile(output,'utf8').catch(()=>'null'));
  snapshot=previous?.sourceUrl===njTransitRailFeed&&previous?.status==='ok'?previous:{status:'error',builtAt:new Date().toISOString(),sourceAt:null,sourceUrl:njTransitRailFeed,totalItems:0,matchedGames:0,byGame:{}};
  console.error(`NJ TRANSIT refresh unavailable; ${snapshot===previous?'retaining dated snapshot':'publishing source gap'}: ${error.message}`);
}
await fs.writeFile(temporary,JSON.stringify(snapshot)+'\n');
await fs.rename(temporary,output);
console.log(JSON.stringify({status:snapshot.status,totalItems:snapshot.totalItems,matchedGames:snapshot.matchedGames}));
