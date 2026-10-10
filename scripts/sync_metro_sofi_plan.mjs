import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {METRO_SOFI_URL,parseMetroSofiPlan} from '../site/metro_sofi_plan.js';

const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site/metro_sofi_plan.json');
let snapshot;
try{
  const response=await fetch(METRO_SOFI_URL,{headers:{Accept:'text/html','User-Agent':'EventAtlas NFL public report (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(15000)});
  if(!response.ok||response.url!==METRO_SOFI_URL)throw Error(`Metro source HTTP ${response.status} or redirect`);
  const size=Number(response.headers.get('content-length'));
  if(Number.isFinite(size)&&size>750000)throw Error('Response too large');
  snapshot=parseMetroSofiPlan(await response.text());
}catch(error){snapshot={status:'unavailable',checkedAt:new Date().toISOString(),sourceUrl:METRO_SOFI_URL,error:String(error.message).slice(0,120)}}
await fs.writeFile(output,JSON.stringify(snapshot)+'\n','utf8');
console.log(`Metro SoFi operator plan: ${snapshot.status}`);
