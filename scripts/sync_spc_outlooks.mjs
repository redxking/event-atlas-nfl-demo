import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SPC_BASE,SPC_LAYERS,matchSpcOutlook} from '../site/spc_outlook.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
const venues=[...new Map(schedule.games.map(game=>[game.venue.id,game.venue])).values()];
const now=Date.now(),sources=[],byVenue={};
for(const layer of SPC_LAYERS){
  const sourceUrl=`${SPC_BASE}/${layer.id}`;
  const query=new URL(`${sourceUrl}/query`);
  query.search=new URLSearchParams({where:'1=1',outFields:'objectid,dn,valid,expire,issue,label,idp_ingestdate',outSR:'4326',f:'geojson'}).toString();
  const response=await fetch(query,{headers:{Accept:'application/geo+json','User-Agent':'EventAtlas/0.4 public SPC outlook context'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`SPC day ${layer.day} HTTP ${response.status}`);
  const body=await response.json();
  if(body.type!=='FeatureCollection'||!Array.isArray(body.features)||body.features.length<1||body.features.length>200)throw Error(`SPC day ${layer.day} invalid feature collection`);
  const stamp=value=>/^\d{12}$/.test(String(value))?new Date(`${String(value).slice(0,4)}-${String(value).slice(4,6)}-${String(value).slice(6,8)}T${String(value).slice(8,10)}:${String(value).slice(10,12)}:00Z`).toISOString():null;
  const issued=body.features.map(item=>item.properties?.issue).filter(value=>/^\d{12}$/.test(String(value))).sort().at(-1);
  const sourceIssueAt=stamp(issued),validAt=stamp(body.features[0].properties?.valid),expiresAt=stamp(body.features[0].properties?.expire);
  if(!validAt||!expiresAt||Date.parse(expiresAt)<=Date.parse(validAt)||body.features.some(item=>stamp(item.properties?.valid)!==validAt||stamp(item.properties?.expire)!==expiresAt))throw Error(`SPC day ${layer.day} validity window inconsistent`);
  if(!sourceIssueAt||now-Date.parse(sourceIssueAt)>24*3600000||Date.parse(sourceIssueAt)>now+60000)throw Error(`SPC day ${layer.day} issue time stale or invalid`);
  const matches=matchSpcOutlook(body.features,venues,layer.day,sourceUrl);
  for(const [venueId,items] of Object.entries(matches))(byVenue[venueId]??=[]).push(...items);
  sources.push({day:layer.day,sourceUrl,sourceIssueAt,validAt,expiresAt,features:body.features.length,matchedVenues:Object.keys(matches).length});
}
const snapshot={status:'ok',builtAt:new Date().toISOString(),sourceUrl:SPC_BASE,basis:'NOAA SPC Day 1–3 categorical forecast polygons matched to unreviewed NFL venue candidate points. Compare published UTC validity to listed kickoff only. These are regional forecasts, not warnings, observed weather, route or venue impacts, or threat assessments. No point match is not an all-clear.',sources,byVenue};
await fs.writeFile(path.join(site,'spc_outlooks.json'),JSON.stringify(snapshot));
console.log(`SPC outlooks: ${sources.map(x=>`day${x.day} ${x.features} features`).join(', ')}; ${Object.keys(byVenue).length} venue candidates with a polygon match`);
