import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNflNews} from '../site/nfl_news_context.js';

const now=Date.parse('2026-10-09T23:50:00Z');
const game={id:'nfl:1'};
const article={title:'Bears news',description:'Source description',url:'https://www.espn.com/nfl/story/_/id/1/example',publisher:'ESPN',matchBasis:'one_team_mentioned',publishedAt:'2026-10-09T22:00:00Z'};

test('fresh ESPN RSS team mentions enter the event context with attribution',()=>{
  const result=selectNflNews(game,{status:'ok',sourceUrl:'https://www.espn.com/espn/rss/nfl/news',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z',byGame:{'nfl:1':[article]}},now);
  assert.equal(result.state,'current_snapshot');
  assert.equal(result.articles[0].matchBasis,'one_team_mentioned');
});

test('stale, failed, or non ESPN article records are not displayed',()=>{
  const base={status:'ok',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z',byGame:{'nfl:1':[article,{...article,url:'https://example.org/nfl/story'}]}};
  assert.equal(selectNflNews(game,base,now).articles.length,1);
  assert.equal(selectNflNews(game,{...base,retrievedAt:'2026-10-08T00:00:00Z'},now).state,'stale');
  assert.equal(selectNflNews(game,{status:'failed'},now).state,'unavailable');
});
