import test from 'node:test';
import assert from 'node:assert/strict';
import {selectKickoffForecast,selectEventHourForecast} from '../site/nws_forecast.js';

const now=Date.parse('2026-10-10T00:00:00Z');
const game={kickoff:'2026-10-11T17:00:00Z',timeTbd:false,status:'scheduled'};
const forecast={state:'ok',checkedAt:now,kickoff:game.kickoff,sourceUrl:'https://api.weather.gov/gridpoints/PHI/50,73/forecast/hourly',period:{startTime:'2026-10-11T16:00:00Z',endTime:'2026-10-11T18:00:00Z',shortForecast:'Chance Rain Showers',temperature:62,temperatureUnit:'F',windSpeed:'5 mph',windDirection:'NW',probabilityOfPrecipitation:{value:45},privateField:'exclude'}};

test('kickoff forecast retains bounded NWS values and exact source',()=>{
  const result=selectKickoffForecast(game,forecast,now);
  assert.equal(result.state,'current forecast');
  assert.equal(result.period.precipitationPercent,45);
  assert.equal(result.period.privateField,undefined);
  assert.equal(result.sourceUrl,forecast.sourceUrl);
});

test('stale, mismatched, and out-of-window forecasts do not enter a brief',()=>{
  assert.equal(selectKickoffForecast(game,{...forecast,checkedAt:now-31*60000},now).state,'unavailable or stale');
  assert.equal(selectKickoffForecast({...game,kickoff:'2026-10-11T18:00:00Z'},forecast,now).state,'unavailable or stale');
  assert.equal(selectKickoffForecast(game,{...forecast,sourceUrl:'https://example.com/forecast'},now).state,'unavailable or stale');
  assert.equal(selectKickoffForecast({...game,kickoff:'2026-10-20T17:00:00Z'},forecast,now).state,'outside forecast window');
});

test('a live game uses a fresh NWS period covering the current event hour',()=>{
  const liveNow=Date.parse('2026-10-11T20:15:00Z');
  const liveGame={...game,status:'in progress in source'};
  const liveForecast={...forecast,checkedAt:liveNow,period:{...forecast.period,startTime:'2026-10-11T20:00:00Z',endTime:'2026-10-11T21:00:00Z'}};
  assert.equal(selectEventHourForecast(liveGame,liveForecast,liveNow).state,'current event-hour forecast');
  assert.equal(selectEventHourForecast(liveGame,{...liveForecast,period:{...liveForecast.period,endTime:'2026-10-11T20:00:00Z'}},liveNow).state,'unavailable or stale');
  assert.equal(selectEventHourForecast({...liveGame,status:'completed in source'},liveForecast,liveNow).state,'outside active event window');
  assert.equal(selectEventHourForecast(liveGame,{...liveForecast,checkedAt:liveNow-31*60000},liveNow).state,'unavailable or stale');
});
