import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DENVER_EVENT_URL,parseDenverEventPlan} from '../site/denver_event_plan.js';
const snapshot={schema:'event-atlas.denver-event-plan.v1',gameId:'nfl:401872995',checkedAt:new Date().toISOString(),sourceUrl:DENVER_EVENT_URL,status:'failed'};
try{
  const response=await fetch(DENVER_EVENT_URL,{redirect:'error',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'EventAtlas/0.4 official-venue-plan'}});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const html=await response.text();
  Object.assign(snapshot,parseDenverEventPlan(html),{status:'ok',sourceTextSha256:createHash('sha256').update(html).digest('hex')});
}catch(error){console.log(`Denver event page unavailable: ${String(error).slice(0,120)}`)}
await writeFile(new URL('../site/denver_event_plan.json',import.meta.url),JSON.stringify(snapshot)+'\n');
console.log(`Denver exact-game plan: ${snapshot.status}`);
