import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {soundTransitAlertsFeed,summarizeSoundTransitAlerts} from '../site/sound_transit_alerts.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const output=path.join(site,'sound_transit_alerts.json');
try{
  const response=await fetch(soundTransitAlertsFeed,{headers:{Accept:'application/json','User-Agent':'EventAtlas-NFL-Demo/0.4'},signal:AbortSignal.timeout(15000)});
  if(!response.ok||new URL(response.url).href!==soundTransitAlertsFeed)throw Error(`Unexpected source response: HTTP ${response.status}`);
  const raw=await response.text();
  if(raw.length<20||raw.length>1000000)throw Error('Service-alert feed size outside bound');
  const snapshot=summarizeSoundTransitAlerts(JSON.parse(raw));
  await fs.writeFile(output,JSON.stringify(snapshot)+'\n');
  console.log(JSON.stringify({status:snapshot.status,sourceAt:snapshot.sourceAt,matchingCount:snapshot.matchingCount}));
}catch(error){
  const previous=JSON.parse(await fs.readFile(output,'utf8').catch(()=>'null'));
  if(['ok','partial'].includes(previous?.status))console.error(`Sound Transit alert refresh failed; retaining dated snapshot: ${error.message}`);
  else await fs.writeFile(output,JSON.stringify({schema:'event-atlas.sound-transit-alerts.v1',status:'error',retrievedAt:new Date().toISOString(),sourceAt:null,sourceUrl:soundTransitAlertsFeed,alerts:[]})+'\n');
}
