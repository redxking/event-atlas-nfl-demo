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

test('schedule change blocks old-window cue comparison',()=>{
  const moved={...game,kickoff:'2026-10-11T21:00:00Z'};
  const changes=diffEventPicture(picture('checked'),picture('checked',[weatherCue]),null,null,game,moved);
  assert.deepEqual(changes.map(item=>item.kind),['schedule_changed']);
});

test('headline addition requires two current publisher snapshots',()=>{
  const article={title:'Packers update',publisher:'CBS Sports',publishedAt:'2026-10-10T00:00:00Z',url:'https://www.cbssports.com/nfl/news/example'};
  const current={state:'current_snapshot',articles:[article]};
  const empty={state:'current_snapshot',articles:[]};
  assert.equal(diffEventPicture(picture('checked'),picture('checked'),empty,current,game,game)[0].kind,'newly_displayed_headline');
  assert.equal(diffEventPicture(picture('checked'),picture('checked'),{state:'unavailable',articles:[]},current,game,game).length,0);
});

test('changed kickoff forecast is logged only across comparable current checks',()=>{
  const base={state:'current forecast',sourceUrl:'https://api.weather.gov/gridpoints/GRB/78,31/forecast/hourly',period:{startTime:'2026-10-11T16:00:00Z',endTime:'2026-10-11T18:00:00Z',shortForecast:'Sunny',temperature:74,temperatureUnit:'F'}};
  const before={...picture('checked'),forecastContext:base};
  const after={...picture('checked'),forecastContext:{...base,period:{...base.period,temperature:70}}};
  const changes=diffEventPicture(before,after,null,null,game,game);
  assert.equal(changes.find(item=>item.kind==='forecast_changed')?.sourceUrl,base.sourceUrl);
  assert.ok(!diffEventPicture(before,{...after,forecastContext:{...after.forecastContext,state:'unavailable or stale'}},null,null,game,game).some(item=>item.kind==='forecast_changed'));
});
