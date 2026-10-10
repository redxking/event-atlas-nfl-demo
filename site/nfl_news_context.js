const HOUR=3600000;
const PUBLISHERS={
  ESPN:{feed:'https://www.espn.com/espn/rss/nfl/news',article:/^https:\/\/(?:www\.)?espn\.com\/nfl\//},
  'CBS Sports':{feed:'https://www.cbssports.com/rss/headlines/nfl/',article:/^https:\/\/(?:www\.)?cbssports\.com\/nfl\//},
  'ESPN news API':{feed:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50',article:/^https:\/\/www\.espn\.com\/nfl\/story\//}
};
const bases=new Set(['one_team_mentioned','both_teams_mentioned','both_teams_in_title','matchup_phrase_in_title']);
const rank={one_team_mentioned:1,both_teams_mentioned:2,both_teams_in_title:3,matchup_phrase_in_title:4};

function selectSource(game,source,now){
  const config=PUBLISHERS[source?.publisher],retrieved=Date.parse(source?.retrievedAt),built=Date.parse(source?.sourceBuiltAt);
  const sourceUrl=config?.feed||null;
  const api=source?.publisher==='ESPN news API'&&source?.sourceTimeBasis==='retrieval_only'&&source?.sourceBuiltAt===null;
  if(!config||source?.sourceUrl&&source.sourceUrl!==sourceUrl||source?.status!=='ok'||!Number.isFinite(retrieved)||!api&&!Number.isFinite(built))return {publisher:source?.publisher||null,state:'unavailable',sourceUrl,asOf:null,articles:[]};
  if(retrieved>now+HOUR||now-retrieved>12*HOUR||!api&&(built>now+HOUR||now-built>12*HOUR))return {publisher:source.publisher,state:'stale',sourceUrl,asOf:source.retrievedAt,articles:[]};
  const raw=source.byGame?.[game.id];
  const articles=Array.isArray(raw)?raw.slice(0,8).filter(item=>item&&item.publisher===source.publisher&&bases.has(item.matchBasis)&&typeof item.title==='string'&&item.title.length<=300&&typeof item.url==='string'&&config.article.test(item.url)&&Number.isFinite(Date.parse(item.publishedAt))&&Date.parse(item.publishedAt)<=now+HOUR&&now-Date.parse(item.publishedAt)<=7*24*HOUR):[];
  return {publisher:source.publisher,state:'current_snapshot',sourceUrl,asOf:source.retrievedAt,articles};
}

export function selectNflNews(game,news,now=Date.now()){
  const expected=news?.schema==='event-atlas.nfl-news.v3'?Object.keys(PUBLISHERS):news?.schema==='event-atlas.nfl-news.v2'?['ESPN','CBS Sports']:null;
  const raw=expected?expected.map(publisher=>Array.isArray(news.sources)&&news.sources.length===expected.length?news.sources.find(item=>item?.publisher===publisher):null):[news];
  const sources=raw.map(item=>selectSource(game,item,now));
  const current=sources.filter(item=>item.state==='current_snapshot');
  const seen=new Set();
  const articles=current.flatMap(item=>item.articles.slice(0,4)).sort((a,b)=>rank[b.matchBasis]-rank[a.matchBasis]||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true}).slice(0,8);
  const asOf=current.length?new Date(Math.max(...current.map(item=>Date.parse(item.asOf)))).toISOString():null;
  return {state:current.length?'current_snapshot':sources.some(item=>item.state==='stale')?'stale':'unavailable',coverage:current.length===sources.length?'complete':'partial',publisher:current.map(item=>item.publisher).join(' + ')||null,sourceUrl:current[0]?.sourceUrl||sources[0]?.sourceUrl||PUBLISHERS.ESPN.feed,asOf,sources:sources.map(({publisher,state,sourceUrl,asOf})=>({publisher,state,sourceUrl,asOf})),articles};
}
