import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {nolaCallsDataset,nolaCallQueries,summarizeNolaCalls} from '../site/nola_public_calls.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'site/nola_public_calls.json');
const schedule=JSON.parse(await fs.readFile(path.join(root,'site/nfl.json'),'utf8'));
const venue=schedule.games.find(game=>game.venue.id==='3493')?.venue;
if(!venue)throw Error('Caesars Superdome is absent from the NFL snapshot');
const checkedAt=Date.now(),query=nolaCallQueries(venue,checkedAt);
const read=async url=>{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 count-only public-source connector'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()};
let status='failed',context=null,error=null;
try{
  const [count,latest,metadata]=await Promise.all([read(query.countUrl),read(query.latestUrl),read(query.metadataUrl)]);
  context=summarizeNolaCalls(count,latest,metadata,query,checkedAt);
  status=context.state==='provisional_delayed_historical'?'ok':'stale_source';
}catch(cause){error=String(cause?.message||cause).slice(0,160)}
const output={schema:'event-atlas.nola-public-calls.v1',builtAt:new Date(checkedAt).toISOString(),status,sourceId:'nopd-opcd-calls-2026',sourceUrl:nolaCallsDataset,scope:'Caesars Superdome unreviewed candidate point; 2 km radius; one preceding New Orleans local calendar date selected for publisher timecreate text; source field time zone unverified',basis:'Count-only Socrata spatial query; separate dataset latest timestamp and metadata update checks. No source records are retained.',caution:'Preliminary, delayed public calls, not active police alerts, stadium incidents, threats, or a trend. Source may reclassify calls for 36 hours and suppress locations for sensitive categories; mapped count can understate total calls. Publisher wall-time zone is not verified.',context,error};
await fs.writeFile(out+'.tmp',JSON.stringify(output)+'\n');
await fs.rename(out+'.tmp',out);
console.log(JSON.stringify({status,nearbyCount:context?.nearbyCount??null,periodStart:context?.periodStart??null,publisherUpdatedAt:context?.publisherUpdatedAt??null,error}));
