import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {METRO_I105_LIST_URL,METRO_I105_DETAIL_URL,parseMetroI105Notice} from '../site/metro_i105_notice.js';

const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site/metro_i105_notice.json');
const get=async url=>{
  const response=await fetch(url,{headers:{Accept:'text/html','User-Agent':'EventAtlas NFL public report (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(15000)});
  if(!response.ok||response.url!==url)throw Error(`Metro HTTP ${response.status} or redirect`);
  const size=Number(response.headers.get('content-length'));
  if(Number.isFinite(size)&&size>250000)throw Error('Metro response too large');
  const html=await response.text();
  if(html.length>250000)throw Error('Metro response too large');
  return html;
};
let snapshot;
try{snapshot=parseMetroI105Notice(...await Promise.all([get(METRO_I105_LIST_URL),get(METRO_I105_DETAIL_URL)]))}
catch(error){snapshot={status:'unavailable',checkedAt:new Date().toISOString(),sourceUrl:METRO_I105_DETAIL_URL,listUrl:METRO_I105_LIST_URL,error:String(error.message).slice(0,120)}}
await fs.writeFile(output,JSON.stringify(snapshot)+'\n','utf8');
console.log(`Metro I-105 work notice: ${snapshot.status}`);
