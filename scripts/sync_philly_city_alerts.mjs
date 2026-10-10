import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {phillyCityAlertsUrl,summarizePhillyCityAlerts} from '../site/philly_city_alerts.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'site/philly_city_alerts.json');
const checkedAt=Date.now();
let context=null,error=null;
try{
  const response=await fetch(phillyCityAlertsUrl,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 public source connector'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  context=summarizePhillyCityAlerts(await response.json(),checkedAt);
}catch(cause){error=String(cause?.message||cause).slice(0,200)}
const output={builtAt:new Date(checkedAt).toISOString(),status:context?.state||'error',sourceId:'phila-site-wide-alerts',sourceUrl:phillyCityAlertsUrl,scope:'City of Philadelphia website-wide emergency notices; city scope only, with no stadium or event geofence',caution:'Website-wide notices are not a complete emergency alert system, police incident feed, stadium advisory, event impact, or threat assessment. An empty response establishes only that this endpoint returned no records at the check.',context,error};
await fs.writeFile(out+'.tmp',JSON.stringify(output)+'\n');
await fs.rename(out+'.tmp',out);
console.log(JSON.stringify({status:output.status,totalReturned:context?.totalReturned??null,invalidCount:context?.invalidCount??null,error}));
