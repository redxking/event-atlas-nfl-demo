import {pointInsideRing} from './ground_relevance.js';

export const WPC_RAIN_BASE='https://mapservices.weather.noaa.gov/vector/rest/services/hazards/wpc_precip_hazards/MapServer';
export const WPC_RAIN_LAYERS=[{day:1,id:0},{day:2,id:1},{day:3,id:2}];
const categories={1:'Marginal',2:'Slight',3:'Moderate',4:'High'};
const utc=value=>{
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(value)))return null;
  const iso=String(value).replace(' ','T')+'Z',date=new Date(iso);
  return Number.isFinite(date.getTime())&&date.toISOString().replace('.000Z','Z')===iso?iso:null;
};
const contains=(point,geometry)=>{
  const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.some(rings=>Array.isArray(rings)&&pointInsideRing(point,rings[0])&&!rings.slice(1).some(ring=>pointInsideRing(point,ring)));
};

export function matchWpcRain(features,venues,day,sourceUrl){
  if(!Array.isArray(features)||features.length>2000||!WPC_RAIN_LAYERS.some(layer=>layer.day===day))throw Error('Invalid WPC rainfall layer');
  const byVenue={};
  for(const feature of features){
    const p=feature?.properties||{},category=categories[p.dn],validAt=utc(p.start_time),expiresAt=utc(p.end_time),issuedAt=utc(p.issue_time);
    if(!category||!validAt||!expiresAt||!issuedAt||Date.parse(expiresAt)<=Date.parse(validAt)||Date.parse(issuedAt)>=Date.parse(expiresAt))continue;
    for(const venue of venues){
      if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||!contains(venue,feature.geometry))continue;
      (byVenue[venue.id]??=[]).push({day,category,categoryRank:p.dn,validAt,expiresAt,issuedAt,sourceUrl});
    }
  }
  return byVenue;
}

export function selectWpcRainForGame(game,snapshot,now=Date.now()){
  const age=now-Date.parse(snapshot?.builtAt),fresh=snapshot?.status==='ok'&&Number.isFinite(age)&&age>=-60000&&age<=12*3600000;
  if(!fresh)return {state:'stale or unavailable',match:null,sourceUrl:WPC_RAIN_BASE};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.timeTbd||!String(game?.status).startsWith('scheduled')||!Number.isFinite(kickoff)||kickoff<now)return {state:'not screenable',match:null,sourceUrl:WPC_RAIN_BASE};
  const matches=(snapshot.byVenue?.[game.venue?.id]||[]).filter(item=>Date.parse(item.validAt)<=kickoff&&kickoff<Date.parse(item.expiresAt)&&WPC_RAIN_LAYERS.some(layer=>layer.day===item.day));
  const match=matches.sort((a,b)=>b.categoryRank-a.categoryRank)[0]||null;
  const withinWindow=(snapshot.sources||[]).some(item=>Date.parse(item.validAt)<=kickoff&&kickoff<Date.parse(item.expiresAt));
  return {state:match?'published outlook at kickoff':!withinWindow?'outside published Day 1–3 window':'no point match in current Day 1–3 outlook',match,sourceUrl:match?.sourceUrl||WPC_RAIN_BASE};
}
