import {pointInsideRing} from './ground_relevance.js';

export const SPC_BASE='https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer';
export const SPC_LAYERS=[{day:1,id:1},{day:2,id:9},{day:3,id:17}];
const labels={2:'Thunderstorm',3:'Marginal',4:'Slight',5:'Enhanced',6:'Moderate',8:'High'};
const utc=value=>{if(!/^\d{12}$/.test(String(value)))return null;const s=String(value),date=new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().startsWith(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`)?date.toISOString():null};
const contains=(point,geometry)=>{
  const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.some(rings=>Array.isArray(rings)&&pointInsideRing(point,rings[0])&&!rings.slice(1).some(ring=>pointInsideRing(point,ring)));
};

export function matchSpcOutlook(features,venues,day,sourceUrl){
  if(!Array.isArray(features)||features.length>200||!SPC_LAYERS.some(layer=>layer.day===day))throw Error('Invalid SPC categorical layer');
  const byVenue={};
  for(const feature of features){
    const p=feature?.properties||{},category=labels[p.dn],validAt=utc(p.valid),expiresAt=utc(p.expire),issuedAt=utc(p.issue);
    if(!category||!validAt||!expiresAt||!issuedAt||Date.parse(expiresAt)<=Date.parse(validAt)||Date.parse(issuedAt)>=Date.parse(expiresAt))continue;
    for(const venue of venues){
      if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||!contains(venue,feature.geometry))continue;
      (byVenue[venue.id]??=[]).push({day,category,categoryRank:p.dn,validAt,expiresAt,issuedAt,sourceUrl});
    }
  }
  return byVenue;
}

export function selectSpcForGame(game,snapshot,now=Date.now()){
  const age=now-Date.parse(snapshot?.builtAt),fresh=snapshot?.status==='ok'&&Number.isFinite(age)&&age>=-60000&&age<=12*3600000;
  if(!fresh)return {state:'stale or unavailable',match:null,sourceUrl:SPC_BASE};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.timeTbd||!String(game?.status).startsWith('scheduled')||!Number.isFinite(kickoff)||kickoff<now)return {state:'not screenable',match:null,sourceUrl:SPC_BASE};
  const matches=(snapshot.byVenue?.[game.venue?.id]||[]).filter(item=>Date.parse(item.validAt)<=kickoff&&kickoff<Date.parse(item.expiresAt)&&SPC_LAYERS.some(layer=>layer.day===item.day));
  const match=matches.sort((a,b)=>b.categoryRank-a.categoryRank)[0]||null;
  const withinWindow=(snapshot.sources||[]).some(item=>Date.parse(item.validAt)<=kickoff&&kickoff<Date.parse(item.expiresAt));
  return {state:match?'published outlook at kickoff':!withinWindow?'outside published Day 1–3 window':'no point match in current Day 1–3 outlook',match,sourceUrl:match?.sourceUrl||SPC_BASE};
}
