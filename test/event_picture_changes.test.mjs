import test from 'node:test';
import assert from 'node:assert/strict';
import {diffEventPicture} from '../site/event_picture_changes.js';

const source=(name,state)=>({name,state,sourceUrl:'https://agency.example/feed'});
const game={kickoff:'2026-10-11T17:00:00Z',status:'scheduled',timeTbd:false,sourceUrl:'https://league.example/game'};
const weatherCue={type:'weather alert',title:'NWS warning',basis:'Published window overlaps event',sourceUrl:'https://weather.example/alert',sourceAt:'2026-10-11T16:00:00Z'};
const picture=(state,cues=[])=>({eventId:'nfl:test',sources:[source('NWS point alerts',state)],cues});

test('new source cue is linked only across comparable current checks',()=>{
  const changes=diffEventPicture(picture('checked'),picture('checked',[weatherCue]),null,null,game,game);
  assert.equal(changes.length,1);
  assert.equal(changes[0].kind,'newly_displayed_cue');
  assert.equal(changes[0].sourceUrl,weatherCue.sourceUrl);
  assert.match(changes[0].detail,/not a confirmed venue impact or threat/);
  assert.equal(diffEventPicture(picture('source failed'),picture('checked',[weatherCue]),null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,0);
});

test('Philadelphia notice changes are reported only across complete city checks, without clearance claims',()=>{
  const notice={title:'Citywide notice',detail:'Initial text',url:'https://www.phila.gov/notice'};
  const city=alerts=>({state:'retrieved',alerts,sourceUrl:'https://api.phila.gov/phila/site-wide-alerts/v1'});
  const before={...picture('checked'),citywideAlertsContext:city([notice])};
  const after={...picture('checked'),citywideAlertsContext:city([{...notice,detail:'Updated text'},{title:'New notice',detail:'New text',url:'https://www.phila.gov/new'}])};
  assert.deepEqual(diffEventPicture(before,after,null,null,game,game).map(item=>item.kind),['city_notice_changed','new_city_notice']);
  assert.equal(diffEventPicture(after,before,null,null,game,game).some(item=>/resolved|cleared/.test(item.kind)),false);
  assert.equal(diffEventPicture({...before,citywideAlertsContext:{...city([notice]),state:'partial'}},after,null,null,game,game).some(item=>item.kind==='new_city_notice'),false);
});

test('schedule change blocks old-window cue comparison',()=>{
  const moved={...game,kickoff:'2026-10-11T21:00:00Z'};
  const changes=diffEventPicture(picture('checked'),picture('checked',[weatherCue]),null,null,game,moved);
  assert.deepEqual(changes.map(item=>item.kind),['schedule_changed']);
});

test('score changes require two newer retrieved publisher states',()=>{
  const earlier={...game,sourceRetrievedAt:'2026-10-11T18:00:00Z',gameState:{phase:'in progress',away:{name:'Away',score:7},home:{name:'Home',score:3},period:1,clock:'10:00'}};
  const later={...earlier,sourceRetrievedAt:'2026-10-11T19:00:00Z',gameState:{...earlier.gameState,away:{name:'Away',score:10}}};
  const change=diffEventPicture(picture('checked'),picture('checked'),null,null,earlier,later).find(item=>item.kind==='game_state_changed');
  assert.equal(change?.sourceUrl,game.sourceUrl);
  assert.match(change.detail,/does not establish crowd movement/);
  assert.ok(!diffEventPicture(picture('checked'),picture('checked'),null,null,earlier,{...later,sourceRetrievedAt:earlier.sourceRetrievedAt}).some(item=>item.kind==='game_state_changed'));
});

test('headline addition requires two current publisher snapshots',()=>{
  const article={title:'Packers update',publisher:'CBS Sports',publishedAt:'2026-10-10T00:00:00Z',url:'https://www.cbssports.com/nfl/news/example'};
  const current={state:'current_snapshot',articles:[article]};
  const empty={state:'current_snapshot',articles:[]};
  assert.equal(diffEventPicture(picture('checked'),picture('checked'),empty,current,game,game)[0].kind,'newly_displayed_headline');
  assert.equal(diffEventPicture(picture('checked'),picture('checked'),{state:'unavailable',articles:[]},current,game,game).length,0);
});

test('game-linked article revisions require two newer current snapshots',()=>{
  const article={type:'Preview',headline:'Game preview',url:'https://www.espn.com/nfl/preview?gameId=401872990',modifiedAt:'2026-10-09T20:00:00Z'};
  const before={...picture('checked'),gameArticle:{state:'current_snapshot',asOf:'2026-10-10T01:00:00Z',article}};
  const after={...before,gameArticle:{state:'current_snapshot',asOf:'2026-10-10T02:00:00Z',article:{...article,headline:'Updated game preview'}}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='game_article_changed')?.sourceUrl,article.url);
  assert.ok(!diffEventPicture(before,{...after,gameArticle:{...after.gameArticle,asOf:before.gameArticle.asOf}},null,null,game,game).some(item=>item.kind==='game_article_changed'));
});

test('direct selected-game score changes are recorded only across newer checks',()=>{
  const first={state:'checked',checkedAt:'2026-10-10T01:00:00Z',sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401872990',sourceStatus:'In Progress',gameState:{home:{score:7},away:{score:3}},reportedAttendance:null,article:null,scheduleDiffers:false};
  const next={...first,checkedAt:'2026-10-10T02:00:00Z',gameState:{home:{score:10},away:{score:3}}};
  const before={...picture('checked'),directGame:first},after={...picture('checked'),directGame:next};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='direct_game_state_changed')?.sourceUrl,first.sourceUrl);
  assert.ok(!diffEventPicture(before,{...after,directGame:{...next,checkedAt:first.checkedAt}},null,null,game,game).some(item=>item.kind==='direct_game_state_changed'));
});

test('changed kickoff forecast is logged only across comparable current checks',()=>{
  const base={state:'current forecast',sourceUrl:'https://api.weather.gov/gridpoints/GRB/78,31/forecast/hourly',period:{startTime:'2026-10-11T16:00:00Z',endTime:'2026-10-11T18:00:00Z',shortForecast:'Sunny',temperature:74,temperatureUnit:'F'}};
  const before={...picture('checked'),forecastContext:base};
  const after={...picture('checked'),forecastContext:{...base,period:{...base.period,temperature:70}}};
  const changes=diffEventPicture(before,after,null,null,game,game);
  assert.equal(changes.find(item=>item.kind==='forecast_changed')?.sourceUrl,base.sourceUrl);
  assert.ok(!diffEventPicture(before,{...after,forecastContext:{...after.forecastContext,state:'unavailable or stale'}},null,null,game,game).some(item=>item.kind==='forecast_changed'));
  const activeGame={...game,status:'in progress in source'};
  const liveBefore={...before,forecastContext:{...base,state:'current event-hour forecast'}};
  const liveAfter={...after,forecastContext:{...after.forecastContext,state:'current event-hour forecast'}};
  assert.equal(diffEventPicture(liveBefore,liveAfter,null,null,activeGame,activeGame).find(item=>item.kind==='forecast_changed')?.title,'NWS event-hour forecast changed');
});

test('new NOAA outlook cues require two current comparable publisher snapshots',()=>{
  for(const [type,sourceName] of [['convective outlook','NOAA SPC convective outlook'],['excessive rainfall outlook','NOAA WPC excessive-rainfall outlook']]){
    const outlook={type,title:'Published outlook',basis:'Day 2 polygon at kickoff',sourceUrl:'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/example',sourceAt:'2026-10-10T01:00:00Z'};
    const before={...picture('checked'),sources:[source(sourceName,'no point match in current Day 1–3 outlook')]};
    const after={...before,sources:[source(sourceName,'published outlook at kickoff')],cues:[outlook]};
    assert.equal(diffEventPicture(before,after,null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,1);
    assert.equal(diffEventPicture({...before,sources:[source(sourceName,'stale or unavailable')]},after,null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,0);
  }
});

test('SEPTA alert ID prevents repeat additions when only the feed timestamp changes',()=>{
  const sourceName='SEPTA B Line service alerts';
  const first={type:'transit alert',sourceId:'B-line-1',title:'Service notice',basis:'SEPTA B Line route; SHUTTLE; alert period overlaps illustrative event window.',sourceUrl:'https://www.septa.org/alerts/',sourceAt:'2026-10-10T01:00:00Z'};
  const before={...picture('checked',[first]),sources:[source(sourceName,'current snapshot')]};
  const same={...before,cues:[{...first,sourceAt:'2026-10-10T02:00:00Z'}]};
  assert.equal(diffEventPicture(before,same,null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,0);
  const added={...same,cues:[...same.cues,{...first,sourceId:'B-line-2',title:'Second service notice'}]};
  assert.equal(diffEventPicture(before,added,null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,1);
  assert.equal(diffEventPicture({...before,sources:[source(sourceName,'partial')]},added,null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,0);
});

test('road publisher record link upgrades do not create a new event cue',()=>{
  const oldCue={type:'road condition',sourceId:'ladotd-511-97207',title:'LA 18 roadwork',basis:'DOTD; published window overlaps event',sourceUrl:'https://agency.example/layer',sourceAt:'2026-10-08T16:18:22Z'};
  const before={...picture('checked',[oldCue]),sources:[source('Road conditions','time screened')]};
  const after={...before,cues:[{...oldCue,sourceUrl:'https://agency.example/layer/query?where=EventID%3D97207'}]};
  assert.equal(diffEventPicture(before,after,null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,0);
  const revised={...after,cues:[{...after.cues[0],basis:'DOTD; revised published window overlaps event'}]};
  assert.equal(diffEventPicture(before,revised,null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,1);
});
