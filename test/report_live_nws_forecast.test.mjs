import test from 'node:test';
import assert from 'node:assert/strict';
import {directForecastMode,summarizeDirectForecast,checkDirectForecast} from '../site/report_live_nws_forecast.js';

const now=Date.parse('2026-10-10T12:00:00Z');
const context={monitoringMode:'near_term_monitoring',lat:36.1665,lon:-86.7713,kickoff:'2026-10-11T17:00:00Z',status:'scheduled in source; unreviewed'};
const url='https://api.weather.gov/gridpoints/OHX/50,57/forecast/hourly';
const point={properties:{forecastHourly:url}};
const period=(startTime,endTime,shortForecast='Partly Sunny')=>({startTime,endTime,shortForecast,temperature:65,temperatureUnit:'F',windSpeed:'5 mph',windDirection:'W',probabilityOfPrecipitation:{value:20}});

test('direct forecast is limited to dated, near-term event contexts',()=>{
  assert.equal(directForecastMode(context,now),'kickoff');
  assert.equal(directForecastMode({...context,status:'postponed in source'},now),null);
  assert.equal(directForecastMode({...context,monitoringMode:'season_planning'},now),null);
  assert.equal(directForecastMode({...context,lat:0},now),null);
  assert.equal(directForecastMode({...context,kickoff:'2026-11-11T17:00:00Z'},now),null);
  assert.equal(directForecastMode({...context,status:'in progress in source',kickoff:'2026-10-10T11:00:00Z'},now),'event_hour');
});

test('direct forecast selects the listed kickoff hour and retains publication time',()=>{
  const hourly={properties:{generatedAt:'2026-10-10T11:45:00Z',periods:[period('2026-10-11T16:00:00Z','2026-10-11T17:00:00Z','Wrong hour'),period('2026-10-11T17:00:00Z','2026-10-11T18:00:00Z')]}};
  const result=summarizeDirectForecast(context,point,hourly,now);
  assert.equal(result.mode,'kickoff');
  assert.equal(result.period.shortForecast,'Partly Sunny');
  assert.equal(result.publisherGeneratedAt,'2026-10-10T11:45:00.000Z');
  assert.equal(result.sourceUrl,url);
});

test('active game uses the current event hour and rejects stale or malformed forecasts',()=>{
  const active={...context,status:'in progress in source',kickoff:'2026-10-10T11:00:00Z'};
  const hourly={properties:{generatedAt:'2026-10-10T11:45:00Z',periods:[period('2026-10-10T12:00:00Z','2026-10-10T13:00:00Z')]}};
  assert.equal(summarizeDirectForecast(active,point,hourly,now).mode,'event_hour');
  assert.throws(()=>summarizeDirectForecast(active,point,{properties:{...hourly.properties,generatedAt:'2026-10-09T12:00:00Z'}},now),/stale/);
  assert.throws(()=>summarizeDirectForecast(active,{properties:{forecastHourly:'https://example.com/forecast'}},hourly,now),/unavailable/);
  assert.throws(()=>summarizeDirectForecast(active,point,{properties:{...hourly.properties,periods:[period('2026-10-10T13:00:00Z','2026-10-10T14:00:00Z')]}},now),/covers/);
});

test('direct check never fetches outside its event window',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('unexpected fetch')};
  try{await assert.rejects(checkDirectForecast({...context,monitoringMode:'season_planning'},now),/Outside direct forecast window/)}
  finally{globalThis.fetch=original}
});
