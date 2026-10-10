export const njTransitRailFeed='https://www.njtransit.com/rss/RailAdvisories_feed.xml';
export const njTransitRailPage='https://www.njtransit.com/travel-alerts-to';
const venueId='3839';
const clean=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[entity])).replace(/\s+/g,' ').trim();
const tag=(xml,name)=>clean(xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');
const localDay=value=>{
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const teamName=name=>String(name||'').split(' ').at(-1).toLowerCase();
const publishedDay=title=>{
  const match=title.match(/\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if(!match)return null;
  const time=Date.parse(`${match[1]} ${match[2]}, ${match[3]} 12:00:00 GMT-0400`);
  return Number.isFinite(time)?localDay(time):null;
};
const regionalDay=(title,referenceDate)=>{
  const match=title.match(/\bOn\s+(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(20\d{2}))?\b/i);
  if(!match)return null;
  const year=match[3]||referenceDate?.slice(0,4),time=Date.parse(`${match[1]} ${match[2]}, ${year} 12:00:00 GMT-0400`);
  return Number.isFinite(time)?localDay(time):null;
};

export function summarizeNjTransitRailFeed(xml,games,checkedAt=Date.now()){
  if(typeof xml!=='string'||xml.length>500000||!xml.includes('<rss')||!xml.includes('NJ TRANSIT RAIL ADVISORIES')||!Array.isArray(games)||!Number.isFinite(checkedAt))throw Error('Unexpected NJ TRANSIT rail feed');
  const channelDate=Date.parse(tag(xml,'pubDate'));
  if(!Number.isFinite(channelDate)||channelDate>checkedAt+60000||checkedAt-channelDate>2*3600000)throw Error('NJ TRANSIT rail feed is stale');
  const chunks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  if(chunks.length>300)throw Error('NJ TRANSIT rail feed exceeds item bound');
  const advisories=[];
  for(const [,item] of chunks){
    const title=tag(item,'description').replace(/\s*For more information:\s*$/i,'').slice(0,500),url=tag(item,'link');
    if(!title||!/^https:\/\/www\.njtransit\.com\/node\/\d{1,12}$/.test(url))continue;
    advisories.push({title,url,publishedAt:tag(item,'pubDate').slice(0,80)});
  }
  const byGame={};
  for(const game of games){
    if(game?.venue?.id!==venueId||game.timeTbd||!Number.isFinite(Date.parse(game.kickoff)))continue;
    const date=localDay(game.kickoff),teamNames=(game.teams||[]).map(team=>teamName(team.name));
    if(teamNames.length!==2||teamNames.some(name=>!name))continue;
    const matches=advisories.filter(item=>{
      const title=item.title.toLowerCase();
      return /\bmetlife stadium\b/i.test(item.title)&&publishedDay(item.title)===date&&teamNames.every(name=>new RegExp(`\\b${name}\\b`,'i').test(title));
    });
    const distinct=[...new Map(matches.map(item=>[item.title.toLowerCase(),item])).values()];
    const regional=advisories.filter(item=>/all NJ TRANSIT rail service/i.test(item.title)&&regionalDay(item.title,date)===date&&new RegExp(`\\b${date.slice(0,4)}\\b`).test(item.publishedAt));
    const regionalDistinct=[...new Map(regional.map(item=>[item.title.toLowerCase(),item])).values()];
    if(distinct.length||regionalDistinct.length)byGame[game.id]={gameDate:date,advisories:distinct.slice(0,4),regionalAdvisories:regionalDistinct.slice(0,4)};
  }
  return {status:'ok',builtAt:new Date(checkedAt).toISOString(),sourceAt:new Date(channelDate).toISOString(),sourceUrl:njTransitRailFeed,sourcePageUrl:njTransitRailPage,totalItems:chunks.length,matchedGames:Object.keys(byGame).length,byGame};
}

export function selectNjTransitRailForGame(game,snapshot,now=Date.now()){
  if(game?.venue?.id!==venueId)return null;
  const checked=Date.parse(snapshot?.builtAt),published=Date.parse(snapshot?.sourceAt);
  const current=snapshot?.status==='ok'&&snapshot?.sourceUrl===njTransitRailFeed&&Number.isFinite(checked)&&Number.isFinite(published)&&checked<=now+60000&&published<=now+60000&&now-checked<=2*3600000&&now-published<=2*3600000&&snapshot.byGame&&typeof snapshot.byGame==='object';
  if(!current)return {state:'stale or unavailable',sourceUrl:njTransitRailPage,advisories:[]};
  const match=snapshot.byGame[game.id],date=localDay(game.kickoff);
  const advisories=match?.gameDate===date&&Array.isArray(match.advisories)?match.advisories:[];
  const regionalAdvisories=match?.gameDate===date&&Array.isArray(match.regionalAdvisories)?match.regionalAdvisories:[];
  return {state:advisories.length?'event-specific advisory listed':regionalAdvisories.length?'regional rail advisory listed':'source checked; no exact event advisory',checkedAt:snapshot.builtAt,sourceAt:snapshot.sourceAt,sourceUrl:njTransitRailPage,gameDate:date,advisories,regionalAdvisories,interpretation:'Publisher event rail-service planning and separately labeled region-wide schedule notices. Neither establishes a disruption, train operation, attendance, stadium access impact, or threat.'};
}
