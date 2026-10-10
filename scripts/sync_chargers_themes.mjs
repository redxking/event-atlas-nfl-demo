import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHARGERS_THEMES_URL,parseChargersThemes} from '../site/chargers_themes.js';

const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site/chargers_themes.json');
let snapshot;
try{
  const response=await fetch(CHARGERS_THEMES_URL,{headers:{Accept:'text/html','User-Agent':'EventAtlas NFL public report (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const size=Number(response.headers.get('content-length'));
  if(Number.isFinite(size)&&size>1_000_000)throw Error('Response too large');
  snapshot=parseChargersThemes(await response.text());
}catch(error){snapshot={status:'unavailable',checkedAt:new Date().toISOString(),sourceUrl:CHARGERS_THEMES_URL,themes:[],error:String(error.message).slice(0,120)}}
await fs.writeFile(output,JSON.stringify(snapshot)+'\n','utf8');
console.log(`Chargers season themes: ${snapshot.status}; ${snapshot.themes.length} published rows`);
