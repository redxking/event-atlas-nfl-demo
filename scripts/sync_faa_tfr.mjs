import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FAA_TFR_LIST,FAA_TFR_GEOMETRY,selectTfrVenueIntersections} from '../site/tfr_relevance.js';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
const venues=[...new Map(schedule.games.map(game=>[game.venue.id,game.venue])).values()];
const get=async url=>{const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 public FAA TFR review'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`FAA TFR HTTP ${response.status}`);return response.json()};
const [list,geo]=await Promise.all([get(FAA_TFR_LIST),get(FAA_TFR_GEOMETRY)]);
if(!Array.isArray(list)||list.length<1||!Array.isArray(geo?.features)||geo.features.length<1)throw Error('FAA TFR list or geometry empty');
const byVenue=selectTfrVenueIntersections(venues,list,geo);
const out={builtAt:new Date().toISOString(),listUrl:FAA_TFR_LIST,geometryUrl:FAA_TFR_GEOMETRY,sourcePageUrl:'https://tfr.faa.gov/tfr3/',basis:'Spatial review only. FAA list includes current or upcoming restrictions. Match uses an unreviewed NFL venue candidate point inside a published shape. Exact effective hours and NOTAM text require separate verification; no drone detection is provided.',listCount:list.length,shapeCount:geo.features.length,venueCount:venues.length,matchedVenueCount:Object.keys(byVenue).length,byVenue};
await fs.writeFile(path.join(site,'tfr.json'),JSON.stringify(out));
console.log(`FAA TFR ${list.length} notices, ${geo.features.length} shapes, ${out.matchedVenueCount} venue candidate matches`);
