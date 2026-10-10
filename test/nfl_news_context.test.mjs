import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNflNews} from '../site/nfl_news_context.js';

const now=Date.parse('2026-10-09T23:50:00Z');
const game={id:'nfl:1'};
const article={title:'Bears news',description:'Source description',url:'https://www.espn.com/nfl/story/_/id/1/example',publisher:'ESPN',matchBasis:'one_team_mentioned',publishedAt:'2026-10-09T22:00:00Z'};

test('fresh ESPN RSS team mentions enter the event context with attribution',()=>{
  const result=selectNflNews(game,{status:'ok',publisher:'ESPN',sourceUrl:'https://www.espn.com/espn/rss/nfl/news',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z',byGame:{'nfl:1':[article]}},now);
  assert.equal(result.state,'current_snapshot');
  assert.equal(result.articles[0].matchBasis,'one_team_mentioned');
});

test('title matching tiers remain labeled publisher discovery context',()=>{
  const base={status:'ok',publisher:'ESPN',sourceUrl:'https://www.espn.com/espn/rss/nfl/news',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z'};
  const articles=['matchup_phrase_in_title','both_teams_in_title','both_teams_mentioned'].map((matchBasis,index)=>({...article,matchBasis,url:`https://www.espn.com/nfl/story/_/id/${index+1}/example`}));
  const result=selectNflNews(game,{...base,byGame:{'nfl:1':articles}},now);
  assert.deepEqual(result.articles.map(item=>item.matchBasis),articles.map(item=>item.matchBasis));
});

test('stale, failed, or non ESPN article records are not displayed',()=>{
  const base={status:'ok',publisher:'ESPN',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z',byGame:{'nfl:1':[article,{...article,url:'https://example.org/nfl/story'}]}};
  assert.equal(selectNflNews(game,base,now).articles.length,1);
  assert.equal(selectNflNews(game,{...base,retrievedAt:'2026-10-08T00:00:00Z'},now).state,'stale');
  assert.equal(selectNflNews(game,{status:'failed'},now).state,'unavailable');
});

test('CBS Sports fallback retains its own publisher and article host',()=>{
  const cbs={...article,publisher:'CBS Sports',description:'',url:'https://www.cbssports.com/nfl/news/example'};
  const result=selectNflNews(game,{status:'ok',publisher:'CBS Sports',sourceUrl:'https://www.cbssports.com/rss/headlines/nfl/',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z',byGame:{'nfl:1':[cbs,article]}},now);
  assert.equal(result.state,'current_snapshot');
  assert.equal(result.publisher,'CBS Sports');
  assert.deepEqual(result.articles,[cbs]);
});

test('two current publishers contribute separately attributed headlines',()=>{
  const cbs={...article,title:'Packers update',publisher:'CBS Sports',description:'',url:'https://www.cbssports.com/nfl/news/packers-update',matchBasis:'both_teams_in_title'};
  const base={status:'ok',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z'};
  const result=selectNflNews(game,{schema:'event-atlas.nfl-news.v2',sources:[
    {...base,publisher:'ESPN',sourceUrl:'https://www.espn.com/espn/rss/nfl/news',byGame:{'nfl:1':[article]}},
    {...base,publisher:'CBS Sports',sourceUrl:'https://www.cbssports.com/rss/headlines/nfl/',byGame:{'nfl:1':[cbs]}}
  ]},now);
  assert.equal(result.coverage,'complete');
  assert.deepEqual(result.articles.map(item=>item.publisher),['CBS Sports','ESPN']);
  assert.equal(result.sources.length,2);
});

test('one failed publisher leaves partial coverage without suppressing current headlines',()=>{
  const result=selectNflNews(game,{schema:'event-atlas.nfl-news.v2',sources:[
    {status:'ok',publisher:'ESPN',sourceUrl:'https://www.espn.com/espn/rss/nfl/news',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z',byGame:{'nfl:1':[article]}},
    {status:'failed',publisher:'CBS Sports',sourceUrl:'https://www.cbssports.com/rss/headlines/nfl/',byGame:{}}
  ]},now);
  assert.equal(result.state,'current_snapshot');
  assert.equal(result.coverage,'partial');
  assert.equal(result.articles.length,1);
  assert.equal(result.sources[1].state,'unavailable');
});

test('ESPN headline API adds fresh linked stories without inventing publisher build time',()=>{
  const apiArticle={...article,publisher:'ESPN news API',description:'',title:'Bears RB out vs. Packers',matchBasis:'matchup_phrase_in_title'};
  const result=selectNflNews(game,{schema:'event-atlas.nfl-news.v3',sources:[
    {status:'ok',publisher:'ESPN',sourceUrl:'https://www.espn.com/espn/rss/nfl/news',retrievedAt:'2026-10-09T23:45:00Z',sourceBuiltAt:'2026-10-09T23:40:00Z',byGame:{'nfl:1':[article]}},
    {status:'failed',publisher:'CBS Sports',sourceUrl:'https://www.cbssports.com/rss/headlines/nfl/',byGame:{}},
    {status:'ok',publisher:'ESPN news API',sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50',sourceBuiltAt:null,sourceTimeBasis:'retrieval_only',retrievedAt:'2026-10-09T23:45:00Z',byGame:{'nfl:1':[apiArticle]}}
  ]},now);
  assert.equal(result.coverage,'partial');
  assert.equal(result.articles[0].publisher,'ESPN news API');
  assert.equal(result.articles.length,1);
  assert.equal(result.sources[2].state,'current_snapshot');
});
