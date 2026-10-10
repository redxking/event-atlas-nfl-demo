export const nj511EventsFeed='https://www.511nj.org/RSS511Service/RSS511Service.svc/rest/rss/RSSAllNJActiveEvents';
export const nj511EventsPage='https://www.511nj.org/';
const venueId='3839';
const entity=value=>String(value||'').replace(/&(?:amp|lt|gt|quot|apos|#39|#x[0-9a-f]+|#\d+);/gi,match=>{
  const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"};
  const lower=match.toLowerCase();
  if(named[lower])return named[lower];
  const code=lower.startsWith('&#x')?parseInt(lower.slice(3,-1),16):parseInt(lower.slice(2,-1),10);
  return Number.isInteger(code)&&code>=32&&code<=0x10ffff?String.fromCodePoint(code):'';
}).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const field=(xml,name)=>entity(xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');
const localDay=value=>{
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const descriptionDay=value=>{
  const match=value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i);
  if(!match)return null;
  const time=Date.parse(`${match[1]} ${match[2]}, ${match[3]} 12:00:00 GMT-0400`);
  return Number.isFinite(time)?localDay(time):null;
};
const descriptionDays=value=>[...String(value||'').matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/gi)].map(match=>{
  const time=Date.parse(`${match[1]} ${match[2]}, ${match[3]} 12:00:00 GMT-0400`);
  return Number.isFinite(time)?localDay(time):null;
}).filter(Boolean);
const distanceKm=(a,b,c,d)=>{
  const rad=Math.PI/180,deltaLat=(c-a)*rad,deltaLon=(d-b)*rad;
  return 12742*Math.asin(Math.sqrt(Math.sin(deltaLat/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(deltaLon/2)**2));
};

export function summarizeNj511Events(xml,games,checkedAt=Date.now()){
  if(typeof xml!=='string'||xml.length>2000000||!xml.includes('<rss')||!xml.includes('<title>All NJ Active Events</title>')||!Array.isArray(games)||!Number.isFinite(checkedAt))throw Error('Unexpected 511NJ feed');
  const sourceAt=Date.parse(field(xml,'pubDate'));
  if(!Number.isFinite(sourceAt)||sourceAt>checkedAt+60000||checkedAt-sourceAt>2*3600000)throw Error('511NJ feed is stale');
  const chunks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  if(chunks.length>3000)throw Error('511NJ feed exceeds item bound');
  const items=chunks.map(([,raw])=>{
    const point=field(raw,'georss:point').split(/\s+/).map(Number),publishedAt=field(raw,'pubDate');
    if(point.length!==2||!Number.isFinite(point[0])||!Number.isFinite(point[1])||point[0]<39||point[0]>42||point[1]<-76||point[1]>-73||!Number.isFinite(Date.parse(publishedAt)))return null;
    return {title:field(raw,'title').slice(0,150),description:field(raw,'description').slice(0,550),publishedAt,lat:point[0],lon:point[1]};
  }).filter(Boolean);
  const byGame={};
  for(const game of games){
    if(game?.venue?.id!==venueId||game.timeTbd||!Number.isFinite(Date.parse(game.kickoff)))continue;
    const date=localDay(game.kickoff),teams=(game.teams||[]).map(team=>String(team.name||'').split(' ').at(-1)?.toLowerCase());
    if(teams.length!==2||teams.some(name=>!name||!/^[a-z0-9]+$/.test(name)))continue;
    const listings=items.filter(item=>/^MetLife Stadium\s*:\s*football game$/i.test(item.title)&&descriptionDay(item.description)===date&&teams.every(name=>new RegExp(`\\b${name}\\b`,'i').test(item.description))&&distanceKm(game.venue.lat,game.venue.lon,item.lat,item.lon)<=1);
    const roads=items.filter(item=>!/(?:football game|concert|special event|sports event|show|racing|market|parade)$/i.test(item.title)&&distanceKm(game.venue.lat,game.venue.lon,item.lat,item.lon)<=8&&descriptionDays(item.description).includes(date)).map(item=>({title:item.title,description:item.description,publishedAt:item.publishedAt,distanceKm:Math.round(distanceKm(game.venue.lat,game.venue.lon,item.lat,item.lon)*10)/10})).sort((a,b)=>a.distanceKm-b.distanceKm||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
    byGame[game.id]={gameDate:date,eventListings:listings.slice(0,2).map(item=>({description:item.description,publishedAt:item.publishedAt})),gameDateRoadCount:roads.length,gameDateRoads:roads.slice(0,12)};
  }
  return {status:'ok',builtAt:new Date(checkedAt).toISOString(),sourceAt:new Date(sourceAt).toISOString(),sourceUrl:nj511EventsFeed,sourcePageUrl:nj511EventsPage,totalItems:chunks.length,byGame};
}

export function selectNj511ForGame(game,snapshot,now=Date.now()){
  if(game?.venue?.id!==venueId)return null;
  const checked=Date.parse(snapshot?.builtAt),source=Date.parse(snapshot?.sourceAt);
  if(snapshot?.status!=='ok'||snapshot.sourceUrl!==nj511EventsFeed||!Number.isFinite(checked)||!Number.isFinite(source)||checked>now+60000||source>now+60000||now-checked>2*3600000||now-source>2*3600000)return {state:'stale or unavailable',sourceUrl:nj511EventsPage,eventListings:[],gameDateRoads:[]};
  const match=snapshot.byGame?.[game.id],date=localDay(game.kickoff);
  if(match?.gameDate!==date)return {state:'source checked; game unmatched',checkedAt:snapshot.builtAt,sourceAt:snapshot.sourceAt,sourceUrl:nj511EventsFeed,eventListings:[],gameDateRoads:[],gameDateRoadCount:0};
  return {state:match.eventListings.length?'exact game listed':'source checked; game unmatched',checkedAt:snapshot.builtAt,sourceAt:snapshot.sourceAt,sourceUrl:nj511EventsFeed,gameDate:date,eventListings:match.eventListings,gameDateRoadCount:match.gameDateRoadCount,gameDateRoads:match.gameDateRoads,interpretation:'511NJ lists the exact game and source road entries within 8 km mentioning its calendar date. Source points are approximate. Calendar-date mention does not establish kickoff-time overlap, an open lane, route impact, stadium incident, or threat.'};
}
