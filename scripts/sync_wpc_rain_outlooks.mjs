import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WPC_RAIN_BASE,WPC_RAIN_LAYERS,matchWpcRain} from '../site/wpc_rain_outlook.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
const venues=[...new Map(schedule.games.map(game=>[game.venue.id,game.venue])).values()];
const now=Date.now(),sources=[],byVenue={};
const stamp=value=>{
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(value)))return null;
  const iso=String(value).replace(' ','T')+'Z',date=new Date(iso);
  return Number.isFinite(date.getTime())&&date.toISOString().replace('.000Z','Z')===iso?iso:null;
};
for(const layer of WPC_RAIN_LAYERS){
  const sourceUrl=`${WPC_RAIN_BASE}/${layer.id}`;
  const query=new URL(`${sourceUrl}/query`);
  query.search=new URLSearchParams({where:'1=1',outFields:'objectid,dn,outlook,issue_time,start_time,end_time,valid_time,product',outSR:'4326',f:'geojson'}).toString();
  const response=await fetch(query,{headers:{Accept:'application/geo+json','User-Agent':'EventAtlas/0.4 public WPC rainfall context'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`WPC day ${layer.day} HTTP ${response.status}`);
  const body=await response.json();
  if(body.type!=='FeatureCollection'||!Array.isArray(body.features)||body.features.length<1||body.features.length>2000)throw Error(`WPC day ${layer.day} invalid feature collection`);
  const first=body.features[0]?.properties||{},validAt=stamp(first.start_time),expiresAt=stamp(first.end_time),issueTimes=body.features.map(item=>stamp(item.properties?.issue_time));
  if(!validAt||!expiresAt||Date.parse(expiresAt)<=Date.parse(validAt)||issueTimes.some(value=>!value)||body.features.some(item=>stamp(item.properties?.start_time)!==validAt||stamp(item.properties?.end_time)!==expiresAt))throw Error(`WPC day ${layer.day} inconsistent source window`);
  const sourceIssueAt=issueTimes.sort().at(-1);
  if(now-Date.parse(sourceIssueAt)>24*3600000||Date.parse(sourceIssueAt)>now+60000)throw Error(`WPC day ${layer.day} issue time stale or invalid`);
  const matches=matchWpcRain(body.features,venues,layer.day,sourceUrl);
  for(const [venueId,items] of Object.entries(matches))(byVenue[venueId]??=[]).push(...items);
  sources.push({day:layer.day,sourceUrl,sourceIssueAt,validAt,expiresAt,features:body.features.length,matchedVenues:Object.keys(matches).length});
}
const snapshot={status:'ok',builtAt:new Date().toISOString(),sourceUrl:WPC_RAIN_BASE,basis:'NOAA WPC Day 1–3 excessive-rainfall outlook polygons matched to unreviewed NFL venue candidate points. Published UTC validity is compared with listed kickoff. Regional flash-flood planning context is not a warning, observed flood, route or venue impact, or threat assessment. No point match is not an all-clear.',sources,byVenue};
await fs.writeFile(path.join(site,'wpc_rain_outlooks.json'),JSON.stringify(snapshot));
console.log(`WPC rainfall outlooks: ${sources.map(x=>`day${x.day} ${x.features} features`).join(', ')}; ${Object.keys(byVenue).length} venue candidates with a polygon match`);
