import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDirectStation,directStationEligible} from '../site/report_live_nws_station.js';

const now=Date.parse('2026-10-10T16:00:00Z');
const context={monitoringMode:'near_term_monitoring',lat:44.50139,lon:-88.06222,kickoff:'2026-10-11T17:00:00Z',status:'scheduled'};
const stationUrl='https://api.weather.gov/gridpoints/GRB/55,44/stations';
const observed='2026-10-10T15:35:00+00:00';
const data={
  [`https://api.weather.gov/points/${context.lat},${context.lon}`]:{properties:{observationStations:stationUrl}},
  [stationUrl]:{features:[{id:'https://api.weather.gov/stations/KGRB',properties:{stationIdentifier:'KGRB',name:'Green Bay airport'},geometry:{coordinates:[-88.13667,44.47944]}}]},
  'https://api.weather.gov/stations/KGRB/observations/latest':{id:`https://api.weather.gov/stations/KGRB/observations/${observed}`,properties:{timestamp:observed,textDescription:'Cloudy',temperature:{unitCode:'wmoUnit:degC',value:14},windSpeed:{unitCode:'wmoUnit:km_h-1',value:0},relativeHumidity:{unitCode:'wmoUnit:percent',value:72}}}
};
const fetchImpl=async url=>({ok:Boolean(data[url]),status:data[url]?200:404,headers:{get:()=>null},text:async()=>JSON.stringify(data[url])});

test('direct report station check retains source time and distance',async()=>{
  assert.equal(directStationEligible(context,now),true);
  const result=await checkDirectStation(context,{fetchImpl,now});
  assert.equal(result.state,'current_station_observation');
  assert.equal(result.stationId,'KGRB');
  assert.equal(result.distanceKm,6.4);
  assert.equal(result.observedAt,'2026-10-10T15:35:00.000Z');
  assert.equal(result.sourceUrl,data['https://api.weather.gov/stations/KGRB/observations/latest'].id);
});

test('direct report station check rejects unsupported windows and stale readings',async()=>{
  assert.equal(directStationEligible({...context,status:'postponed'},now),false);
  assert.equal(directStationEligible(context,now+3*86400000),false);
  await assert.rejects(checkDirectStation(context,{fetchImpl:async url=>({...(await fetchImpl(url)),text:async()=>JSON.stringify(url.endsWith('/latest')?{...data[url],properties:{...data[url].properties,timestamp:'2026-10-10T12:00:00Z'}}:data[url])}),now}),/unavailable or stale/);
});
