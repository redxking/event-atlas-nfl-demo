import {includePublishedNflReport} from './nfl_game_lifecycle.mjs';

const sourceBase='https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=';
const validTime=value=>Number.isFinite(Date.parse(value));

export function selectGameArticleMetadata(game,summary,now=Date.now()){
  const id=String(game?.id||'').replace(/^nfl:/,'');
  const article=summary?.article;
  const type=article?.type;
  const published=Date.parse(article?.published),modified=Date.parse(article?.lastModified);
  const kickoff=Date.parse(game?.kickoff);
  if(!/^\d+$/.test(id)||!article||!/^\d+$/.test(String(article.id||''))||!['Preview','Recap'].includes(type)||String(article.gameId)!==id||typeof article.headline!=='string'||!article.headline.trim()||article.headline.length>300||!Number.isFinite(published)||!Number.isFinite(modified)||published>modified||modified>now+2*3600000||now-published>10*86400000||!Number.isFinite(kickoff)||published<kickoff-10*86400000||published>kickoff+2*86400000)return null;
  return {id:String(article.id||''),type,headline:article.headline.trim(),publishedAt:new Date(published).toISOString(),modifiedAt:new Date(modified).toISOString(),url:`https://www.espn.com/nfl/${type.toLowerCase()}?gameId=${id}`};
}

export async function syncNflGameArticles(games,{fetchImpl=fetch,now=Date.now(),concurrency=4}={}){
  const selected=games.filter(game=>includePublishedNflReport(game,now));
  if(selected.length>35)throw Error('Unexpected game article query count');
  const byGame={},failures=[];
  let cursor=0;
  async function worker(){
    while(cursor<selected.length){
      const game=selected[cursor++],id=game.id.replace(/^nfl:/,'');
      try{
        if(!/^\d+$/.test(id))throw Error('Invalid game ID');
        const response=await fetchImpl(sourceBase+id,{headers:{Accept:'application/json','User-Agent':'EventAtlas NFL event article metadata'},signal:AbortSignal.timeout(15000)});
        if(!response.ok||Number(response.headers?.get('content-length'))>500000)throw Error(`Unexpected HTTP ${response.status}`);
        const body=await response.text();
        if(body.length>500000)throw Error('Oversize ESPN summary');
        const summary=JSON.parse(body);
        if(String(summary?.header?.id)!==id)throw Error('Summary game ID mismatch');
        const article=selectGameArticleMetadata(game,summary,now);
        byGame[game.id]={state:article?'published_article':'no_current_article',article};
      }catch(error){byGame[game.id]={state:'source_failed',article:null};failures.push(`${game.id}: ${String(error.message).slice(0,80)}`)}
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,selected.length)},worker));
  return {status:failures.length===selected.length&&selected.length?'failed':failures.length?'partial':'ok',sourceUrl:sourceBase,retrievedAt:new Date(now).toISOString(),checkedGames:selected.length,failedGames:failures.length,byGame,interpretation:'ESPN game-summary article metadata is keyed to an exact game ID. Headline and link are publisher context, not verified attendance, venue impact, or threat intelligence.'};
}
