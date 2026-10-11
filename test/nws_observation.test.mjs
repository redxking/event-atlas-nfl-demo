import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNwsStationObservation,fetchNwsStationObservation} from '../site/nws_observation.js';

const now=Date.parse('2026-10-10T04:00:00Z');
const venue={lat:44.50139,lon:-88.06222};
const stations={features:[{id:'https://api.weather.gov/stations/KGRB',properties:{stationIdentifier:'KGRB',name:'Green Bay airport'},geometry:{coordinates:[-88.13667,44.47944]}}]};
const record=(time='2026-10-10T03:35:00+00:00')=>({id:`https://api.weather.gov/stations/KGRB/observations/${time}`,properties:{timestamp:time,textDescription:'Cloudy',temperature:{unitCode:'wmoUnit:degC',value:14},windSpeed:{unitCode:'wmoUnit:km_h-1',value:0},relativeHumidity:{unitCode:'wmoUnit:percent',value:71.849},privateValue:'never export'}});

test('nearby NWS station reading retains immutable source and venue distance',()=>{
  const selected=selectNwsStationObservation(venue,stations,{KGRB:record()},now);
  assert.equal(selected.state,'current_station_observation');
  assert.equal(selected.stationId,'KGRB');
  assert.equal(selected.distanceKm,6.4);
  assert.equal(selected.observedAt,'2026-10-10T03:35:00.000Z');
  assert.equal(selected.sourceUrl,record().id);
  assert.equal(selected.humidityPercent,71.8);
  assert.equal(JSON.stringify(selected).includes('privateValue'),false);
});

test('stale, remote, and mismatched records fail closed',()=>{
  assert.equal(selectNwsStationObservation(venue,stations,{KGRB:record('2026-10-10T02:00:00+00:00')},now).state,'unavailable_or_stale');
  assert.equal(selectNwsStationObservation(venue,stations,{KGRB:{...record(),id:'https://example.org/observation'}},now).state,'unavailable_or_stale');
  assert.equal(selectNwsStationObservation(venue,{features:[{...stations.features[0],geometry:{coordinates:[-90,44.5]}}]},{KGRB:record()},now).state,'unavailable_or_stale');
  assert.equal(selectNwsStationObservation(venue,stations,{KGRB:record('2026-10-10T04:05:00+00:00')},now).state,'unavailable_or_stale');
});


test('malformed station coordinates cannot throw or produce a usable reading',()=>{
  for(const coordinates of [null,{},'not a point',[],[-88],[-88,100],[-200,44],[-88,NaN]]){
    const invalid={features:[{...stations.features[0],geometry:{coordinates}}]};
    assert.equal(selectNwsStationObservation(venue,invalid,{KGRB:record()},now).state,'unavailable_or_stale');
  }
  assert.equal(selectNwsStationObservation({...venue,lat:100},stations,{KGRB:record()},now).state,'unavailable_or_stale');
});

test('a malformed inventory entry does not suppress a valid nearby station',async()=>{
  const inventory={features:[{...stations.features[0],geometry:{coordinates:{}}},...stations.features]};
  assert.equal(selectNwsStationObservation(venue,inventory,{KGRB:record()},now).stationId,'KGRB');
  const requested=[];
  const fetchImpl=async url=>{
    requested.push(url);
    const payload=url.includes('/points/')?{properties:{observationStations:'https://api.weather.gov/gridpoints/GRB/1,1/stations'}}:url.endsWith('/stations')?inventory:record();
    return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(payload)};
  };
  assert.equal((await fetchNwsStationObservation(venue,{fetchImpl,now})).stationId,'KGRB');
  assert.equal(requested.length,3);
  assert.equal(requested[2],'https://api.weather.gov/stations/KGRB/observations/latest');
});
