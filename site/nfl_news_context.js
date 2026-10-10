const HOUR=3600000;

export function selectNflNews(game,news,now=Date.now()){
  const sourceUrl=news?.sourceUrl||'https://www.espn.com/espn/rss/nfl/news';
  const retrieved=Date.parse(news?.retrievedAt),built=Date.parse(news?.sourceBuiltAt);
  if(news?.status!=='ok'||!Number.isFinite(retrieved)||!Number.isFinite(built))return {state:'unavailable',sourceUrl,asOf:null,articles:[]};
  if(retrieved>now+HOUR||built>now+HOUR||now-retrieved>12*HOUR||now-built>12*HOUR)return {state:'stale',sourceUrl,asOf:news.retrievedAt,articles:[]};
  const raw=news.byGame?.[game.id];
  const articles=Array.isArray(raw)?raw.slice(0,8).filter(item=>item&&item.publisher==='ESPN'&&['one_team_mentioned','both_teams_mentioned'].includes(item.matchBasis)&&typeof item.url==='string'&&/^https:\/\/(?:www\.)?espn\.com\/nfl\//.test(item.url)):[];
  return {state:'current_snapshot',sourceUrl,asOf:news.retrievedAt,articles};
}
