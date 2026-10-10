import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const bundle={schema:'event-atlas.public-evidence-bundle.v1',generatedAt:'2026-10-10T01:00:00Z',event:{title:'Away at Home',week:5,status:'scheduled',kickoff:'2026-10-11T20:00:00Z',sourceUrl:'https://example.org/game'},venue:{name:'Example Stadium',address:'Example, AZ, USA',lat:33.5,lon:-112.2},picture:{cueCounts:{weather:0,road:1,transit:0},cues:[{type:'road condition',title:'Listed lane work',basis:'Published window overlaps kickoff; impact unverified',sourceAt:'2026-10-10T00:00:00Z',sourceUrl:'https://example.org/road'}],sources:[{name:'Road conditions',state:'time screened',asOf:'2026-10-10T00:00:00Z',detail:'Proximity is not route impact.',sourceUrl:'https://example.org/road'}],gaps:['No verified stadium CCTV stream is connected.']},publicObservations:{nflHeadlines:{articles:[]},roads:[{kind:'Work zone',name:'101st Ave',agency:'AZTech WZDx',distanceKm:2,detail:'Lane work',startAt:null,endAt:null,sourceUrl:'https://example.org/road'}],cameras:[],weather:[],earthquakes:[],nationalAdvisory:{state:'current national snapshot',active:[],sourceUrl:'https://example.org/ntas'}},sourceSnapshots:{schedule:'2026-10-10T00:00:00Z',roads:'2026-10-10T00:00:00Z'},protectedPeople:{state:'not_collected_in_public_demo'},useLimit:'Analyst verification required.'};

test('public report binds event, current source cues, records, gaps, and source links without a threat claim',()=>{
  const report=buildNflPublicReport(bundle);
  for(const expected of ['Away at Home','2026-10-10T01:00:00.000Z','Listed lane work','AZTech WZDx','No verified stadium CCTV stream','https://example.org/road','Severity not assessed','NOAA SPC Day 1–3 outlook','NOAA WPC excessive-rainfall outlook','named-person records are not collected'])assert.ok(report.includes(expected),expected);
  assert.ok(!report.includes('Threat level:'));
  assert.ok(report.includes('[Publisher event record](https://example.org/game)'));
});

test('public report flattens untrusted publisher text and omits unsafe links',()=>{
  const altered=structuredClone(bundle);altered.picture.cues[0].title='Lane work\n## FALSE ASSESSMENT';altered.picture.cues[0].sourceUrl='javascript:alert(1)';
  const report=buildNflPublicReport(altered);
  assert.ok(report.includes('Lane work ## FALSE ASSESSMENT'));
  assert.ok(!report.includes('\n## FALSE ASSESSMENT'));
  assert.ok(!report.includes('javascript:'));
  assert.ok(report.includes('Source link unavailable'));
  assert.throws(()=>buildNflPublicReport({schema:'wrong'}),/required/);
});

test('report keeps delayed police counts and station service plans distinct from live alerts',()=>{
  const withSources=structuredClone(bundle);
  withSources.picture.sources.push({name:'Local police activity',sourceUrl:'https://gis.indy.gov/server/rest/services/IMPD/IMPD_Public_Data/FeatureServer/0'});
  withSources.publicObservations.policeAggregate={nearby:2877,start:'2026-10-01',end:'2026-10-08',sourceLagHours:29.2,radiusKm:5};
  withSources.sourceSnapshots.police='2026-10-09T22:18:40Z';
  withSources.publicObservations.stationSchedule={serviceDate:'2026-10-11',totalReturned:4,screenable:true,withinWindowCount:2,state:'retrieved',checkedAt:'2026-10-10T01:23:45Z',sourceUrl:'https://api-v3.mbta.com/schedules?filter%5Bstop%5D=place-FS-0049'};
  const report=buildNflPublicReport(withSources);
  for(const expected of ['2026-10-01 through 2026-10-08','29.2 hours','https://gis.indy.gov/server/rest/services/IMPD/IMPD_Public_Data/FeatureServer/0','Foxboro station service plan','Within illustrative event window','https://api-v3.mbta.com/schedules'])assert.ok(report.includes(expected),expected);
  assert.ok(report.includes('not active police alerts'));
  assert.ok(report.includes('not a train position'));
});

test('active event report labels hourly forecast as a forecast for the event hour',()=>{
  const active=structuredClone(bundle);
  active.event.status='in progress in source';
  active.publicObservations.kickoffForecast={state:'current event-hour forecast',checkedAt:'2026-10-11T21:05:00Z',sourceUrl:'https://api.weather.gov/gridpoints/PHI/50,73/forecast/hourly',period:{shortForecast:'Rain Showers',temperature:65,temperatureUnit:'F',windSpeed:'8 mph',windDirection:'NW',precipitationPercent:60}};
  const report=buildNflPublicReport(active);
  assert.ok(report.includes('## Current event-hour forecast'));
  assert.ok(report.includes('Forecast, not an observed condition'));
  assert.ok(!report.includes('## Kickoff forecast'));
});

test('publisher scoreboard state is attributed without implying security impact',()=>{
  const active=structuredClone(bundle);
  active.event.status='in progress in source';
  active.event.sourceRetrievedAt='2026-10-11T21:06:00Z';
  active.event.gameState={phase:'in progress',away:{name:'Away',score:20},home:{name:'Home',score:17},period:3,clock:'05:14'};
  const report=buildNflPublicReport(active);
  assert.match(report,/Publisher game state.*Away 20, Home 17; period 3, clock 05:14/);
  assert.match(report,/do not establish crowd movement, public-safety impact, or a threat/);
});

test('exact-game publisher headline is linked separately from broad RSS mentions',()=>{
  const linked=structuredClone(bundle);
  linked.publicObservations.gameArticle={state:'current_snapshot',asOf:'2026-10-10T02:00:00Z',article:{type:'Preview',headline:'Game preview',publishedAt:'2026-10-09T18:00:00Z',modifiedAt:'2026-10-09T20:00:00Z',url:'https://www.espn.com/nfl/preview?gameId=401872990'}};
  const report=buildNflPublicReport(linked);
  assert.match(report,/Game-linked publisher article/);
  assert.match(report,/Preview: Game preview/);
  assert.match(report,/exact game ID/);
});
