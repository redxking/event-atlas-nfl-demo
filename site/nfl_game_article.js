const HOUR=3600000;

export function selectNflGameArticle(game,snapshot,now=Date.now()){
  const sourceUrl=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${String(game?.id||'').replace(/^nfl:/,'')}`;
  const at=Date.parse(snapshot?.retrievedAt);
  if(!snapshot||!['ok','partial'].includes(snapshot.status)||!Number.isFinite(at)||at>now+HOUR||now-at>12*HOUR)return {state:'stale_or_unavailable',asOf:null,sourceUrl,article:null};
  const row=snapshot.byGame?.[game.id];
  if(!row)return {state:'not_checked',asOf:snapshot.retrievedAt,sourceUrl,article:null};
  if(row.state!=='published_article'||!row.article)return {state:row.state==='source_failed'?'source_failed':'no_current_article',asOf:snapshot.retrievedAt,sourceUrl,article:null};
  const item=row.article,id=String(game.id).replace(/^nfl:/,'');
  if(!['Preview','Recap'].includes(item.type)||typeof item.headline!=='string'||!item.headline.trim()||item.headline.length>300||item.url!==`https://www.espn.com/nfl/${item.type.toLowerCase()}?gameId=${id}`||!Number.isFinite(Date.parse(item.publishedAt))||!Number.isFinite(Date.parse(item.modifiedAt)))return {state:'invalid_article',asOf:snapshot.retrievedAt,sourceUrl,article:null};
  return {state:'current_snapshot',asOf:snapshot.retrievedAt,sourceUrl,article:item};
}
