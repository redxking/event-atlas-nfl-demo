const HOUR=3600000;
const PUBLISHERS={
  ESPN:{feed:'https://www.espn.com/espn/rss/nfl/news',article:/^https:\/\/(?:www\.)?espn\.com\/nfl\//},
  'CBS Sports':{feed:'https://www.cbssports.com/rss/headlines/nfl/',article:/^https:\/\/(?:www\.)?cbssports\.com\/nfl\//}
};
const bases=new Set(['one_team_mentioned','both_teams_mentioned','both_teams_in_title','matchup_phrase_in_title']);
const rank={one_team_mentioned:1,both_teams_mentioned:2,both_teams_in_title:3,matchup_phrase_in_title:4};

function selectSource(game,source,now){
  const config=PUBLISHERS[source?.publisher],retrieved=Date.parse(source?.retrievedAt),built=Date.parse(source?.sourceBuiltAt);
  const sourceUrl=config?.feed||null;
  if(!config||source?.sourceUrl&&source.sourceUrl!==sourceUrl||source?.status!=='ok'||!Number.isFinite(retrieved)||!Number.isFinite(built))return {publisher:source?.publisher||null,state:'unavailable',sourceUrl,asOf:null,articles:[]};
  if(retrieved>now+HOUR||built>now+HOUR||now-retrieved>12*HOUR||now-built>12*HOUR)return {publisher:source.publisher,state:'stale',sourceUrl,asOf:source.retrievedAt,articles:[]};
  const raw=source.byGame?.[game.id];
  const articles=Array.isArray(raw)?raw.slice(0,8).filter(item=>item&&item.publisher===source.publisher&&bases.has(item.matchBasis)&&typeof item.title==='string'&&item.title.length<=300&&typeof item.url==='string'&&config.article.test(item.url)&&Number.isFinite(Date.parse(item.publishedAt))):[];
  return {publisher:source.publisher,state:'current_snapshot',sourceUrl,asOf:source.retrievedAt,articles};
}

export function selectNflNews(game,news,now=Date.now()){
  const raw=news?.schema==='event-atlas.nfl-news.v2'?Object.keys(PUBLISHERS).map(publisher=>Array.isArray(news.sources)&&news.sources.length===2?news.sources.find(item=>item?.publisher===publisher):null):[news];
  const sources=raw.map(item=>selectSource(game,item,now));
  const current=sources.filter(item=>item.state==='current_snapshot');
  const articles=current.flatMap(item=>item.articles.slice(0,4)).sort((a,b)=>rank[b.matchBasis]-rank[a.matchBasis]||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,8);
  const asOf=current.length?new Date(Math.max(...current.map(item=>Date.parse(item.asOf)))).toISOString():null;
  return {state:current.length?'current_snapshot':sources.some(item=>item.state==='stale')?'stale':'unavailable',coverage:current.length===sources.length?'complete':'partial',publisher:current.map(item=>item.publisher).join(' + ')||null,sourceUrl:current[0]?.sourceUrl||sources[0]?.sourceUrl||PUBLISHERS.ESPN.feed,asOf,sources:sources.map(({publisher,state,sourceUrl,asOf})=>({publisher,state,sourceUrl,asOf})),articles};
}
