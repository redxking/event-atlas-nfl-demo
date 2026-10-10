import {includePublishedNflReport} from './nfl_game_lifecycle.mjs';
import {selectGameArticleMetadata} from '../site/espn_game_summary.js';

const sourceBase='https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=';
export {selectGameArticleMetadata};

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
        if(!response.ok||Number(response.headers?.get('content-length'))>1500000)throw Error(`Unexpected HTTP ${response.status}`);
        const body=await response.text();
        if(body.length>1500000)throw Error('Oversize ESPN summary');
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
