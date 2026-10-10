import test from 'node:test';
import assert from 'node:assert/strict';
import {selectGameArticleMetadata,syncNflGameArticles} from '../lib/nfl_game_article_source.mjs';
import {selectNflGameArticle} from '../site/nfl_game_article.js';

const now=Date.parse('2026-10-10T02:00:00Z');
const game={id:'nfl:401872990',kickoff:'2026-10-11T17:00:00Z',status:'scheduled in source; unreviewed',timeTbd:false};
const article={id:50135974,gameId:'401872990',type:'Preview',headline:'Bears at Packers game preview',published:'2026-10-09T18:00:00Z',lastModified:'2026-10-09T20:00:00Z',story:'Do not retain this article body',injuries:[{athlete:'Do not retain'}]};

test('game article metadata requires exact game ID and current publisher times',()=>{
  const selected=selectGameArticleMetadata(game,{article},now);
  assert.equal(selected.url,'https://www.espn.com/nfl/preview?gameId=401872990');
  assert.equal(JSON.stringify(selected).includes('story'),false);
  assert.equal(selectGameArticleMetadata(game,{article:{...article,gameId:'401872991'}},now),null);
  assert.equal(selectGameArticleMetadata(game,{article:{...article,lastModified:'2026-10-11T10:00:00Z'}},now),null);
});

test('source snapshot preserves per-game failure without inventing an article',async()=>{
  const second={...game,id:'nfl:401872991'};
  const snapshot=await syncNflGameArticles([game,second],{now,fetchImpl:async url=>{
    if(url.endsWith('991'))throw Error('source unavailable');
    return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({header:{id:'401872990'},article})};
  }});
  assert.equal(snapshot.status,'partial');
  assert.equal(snapshot.byGame[game.id].article.headline,article.headline);
  assert.equal(snapshot.byGame[second.id].state,'source_failed');
  assert.equal(JSON.stringify(snapshot).includes('Do not retain'),false);
  assert.equal(selectNflGameArticle(game,snapshot,now).state,'current_snapshot');
  assert.equal(selectNflGameArticle(second,snapshot,now).state,'source_failed');
  assert.equal(selectNflGameArticle(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
});
