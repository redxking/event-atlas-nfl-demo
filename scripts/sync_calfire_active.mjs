import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CALFIRE_URL,parseCalfireActive} from '../site/calfire_active.js';

const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site/calfire_active.json');
let snapshot;
try{
  const response=await fetch(CALFIRE_URL,{headers:{Accept:'text/html','User-Agent':'EventAtlas NFL public report (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const size=Number(response.headers.get('content-length'));
  if(Number.isFinite(size)&&size>2_000_000)throw Error('Response too large');
  snapshot=parseCalfireActive(await response.text());
}catch(error){snapshot={status:'unavailable',checkedAt:new Date().toISOString(),sourceUrl:CALFIRE_URL,incidents:[],error:String(error.message).slice(0,120)}}
await fs.writeFile(output,JSON.stringify(snapshot)+'\n','utf8');
console.log(`CAL FIRE active incidents: ${snapshot.status}; ${snapshot.incidents.length} source rows`);
