import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {nj511EventsFeed,summarizeNj511Events} from '../site/nj511_events.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
if(schedule?.source?.status!=='ok'||!Array.isArray(schedule.games)||Date.now()-Date.parse(schedule.builtAt)>12*3600000)throw Error('Fresh NFL schedule required');
const output=path.join(site,'nj511_events.json'),temporary=output+'.tmp';
let snapshot;
try{
  const response=await fetch(nj511EventsFeed,{headers:{Accept:'application/rss+xml, application/xml','User-Agent':'EventAtlas-NFL-Demo/0.4'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`511NJ HTTP ${response.status}`);
  snapshot=summarizeNj511Events(await response.text(),schedule.games);
}catch(error){
  const previous=JSON.parse(await fs.readFile(output,'utf8').catch(()=>'null'));
  snapshot=previous?.sourceUrl===nj511EventsFeed&&previous?.status==='ok'?previous:{status:'error',builtAt:new Date().toISOString(),sourceAt:null,sourceUrl:nj511EventsFeed,totalItems:0,byGame:{}};
  console.error(`511NJ refresh unavailable; ${snapshot===previous?'retaining dated snapshot':'publishing source gap'}: ${error.message}`);
}
await fs.writeFile(temporary,JSON.stringify(snapshot)+'\n');
await fs.rename(temporary,output);
console.log(JSON.stringify({status:snapshot.status,totalItems:snapshot.totalItems,matchedGames:Object.values(snapshot.byGame||{}).filter(item=>item.eventListings?.length).length}));
