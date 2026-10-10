import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const bundle={schema:'event-atlas.public-evidence-bundle.v1',generatedAt:'2026-10-10T01:00:00Z',event:{title:'Away at Home',week:5,status:'scheduled',kickoff:'2026-10-11T20:00:00Z',sourceUrl:'https://example.org/game'},venue:{name:'Example Stadium',address:'Example, AZ, USA',lat:33.5,lon:-112.2},picture:{cueCounts:{weather:0,road:1,transit:0},cues:[{type:'road condition',title:'Listed lane work',basis:'Published window overlaps kickoff; impact unverified',sourceAt:'2026-10-10T00:00:00Z',sourceUrl:'https://example.org/road'}],sources:[{name:'Road conditions',state:'time screened',asOf:'2026-10-10T00:00:00Z',detail:'Proximity is not route impact.',sourceUrl:'https://example.org/road'}],gaps:['No verified stadium CCTV stream is connected.']},publicObservations:{nflHeadlines:{articles:[]},roads:[{kind:'Work zone',name:'101st Ave',agency:'AZTech WZDx',distanceKm:2,detail:'Lane work',startAt:null,endAt:null,sourceUrl:'https://example.org/road'}],cameras:[],weather:[],earthquakes:[],nationalAdvisory:{state:'current national snapshot',active:[],sourceUrl:'https://example.org/ntas'}},sourceSnapshots:{schedule:'2026-10-10T00:00:00Z',roads:'2026-10-10T00:00:00Z'},protectedPeople:{state:'not_collected_in_public_demo'},useLimit:'Analyst verification required.'};

test('public report binds event, current source cues, records, gaps, and source links without a threat claim',()=>{
  const report=buildNflPublicReport(bundle);
  for(const expected of ['Away at Home','2026-10-10T01:00:00.000Z','Listed lane work','AZTech WZDx','No verified stadium CCTV stream','https://example.org/road','Severity not assessed','NOAA SPC Day 1–3 outlook','NOAA WPC excessive-rainfall outlook','Not verified; named-person appearances are announced plans'])assert.ok(report.includes(expected),expected);
  assert.ok(!report.includes('Threat level:'));
  assert.ok(report.includes('[Publisher event record](https://example.org/game)'));
  assert.match(report,/## Dated source timeline[\s\S]*2026-10-10T00:00:00\.000Z — road condition: Listed lane work/);
  assert.match(report,/not an incident chronology/);
});

test('Packers exact-game report attributes announced people and flyover without claiming attendance',()=>{
  const selected=structuredClone(bundle);
  selected.event.id='nfl:401872990';
  selected.venue.id='3798';
  selected.publicObservations.packersGameSpecificAnnouncements={state:'current_published_announcements',asOf:'2026-10-10T06:00:00Z',sources:[{id:'event',state:'checked',publishedAt:'2026-10-08T21:45:51Z',sourceUrl:'https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026'}],claims:[{id:'flyover',category:'aviation',summary:'Packers announce a planned F-35 flyover.',sourceUrl:'https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026'},{id:'featured_alumni',category:'announced_people',summary:'Packers name Ryan Longwell and Bubba Franks as featured alumni.',sourceUrl:'https://www.packers.com/news/packers-welcoming-bubba-franks-ryan-longwell-as-featured-alumni-this-week-oct-8-2026'}]};
  const report=buildNflPublicReport(selected);
  assert.match(report,/Packers–Bears club-announced people and production/);
  assert.match(report,/Ryan Longwell and Bubba Franks/);
  assert.match(report,/not verified attendees or protected persons/);
});

test('club flyover comparison keeps FAA event listing separate from flight observation',()=>{
  const selected=structuredClone(bundle);
  selected.event.id='nfl:401872990';
  selected.publicObservations.clubAviationComparison={state:'club_plan_and_faa_event_record',summary:'Club plan and FAA listing are published records, not a flight observation.',clubSourceUrl:'https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026',faaSourceUrl:'https://faasysops.maps.arcgis.com/home/item.html?id=9f246af52c4049b99b50a2b97e2e5b2c',tfrSourceUrl:'https://tfr.faa.gov/tfr3/',tfrListState:'current bounded list checked',tfrSpatialCandidates:0,faaRecord:{status:'SCHEDULED',startAt:'2026-10-11T16:00:00Z',endAt:'2026-10-11T21:00:00Z'}};
  const report=buildNflPublicReport(selected);
  assert.match(report,/Club flyover and FAA event-record comparison/);
  assert.match(report,/2026-10-11T16:00:00.000Z/);
  assert.match(report,/A missing bounded TFR candidate is not an all-clear/);
});

test('season planning report does not imply live event checks',()=>{
  const planning={...structuredClone(bundle),reportMonitoringMode:'season_planning'};
  const report=buildNflPublicReport(planning);
  assert.match(report,/Season planning snapshot; point alerts and event-hour forecasts are not checked until the event enters the seven-day window/);
  assert.ok(!report.includes('Near-term source monitoring'));
});

test('report presents source-linked analyst action as unreviewed verification',()=>{
  const withQueue=structuredClone(bundle);
  withQueue.picture.reviewQueue={state:'review_candidates',items:[{domain:'road access',trigger:'Listed lane work',basis:'Published window overlaps kickoff',sourceAt:'2026-10-10T00:00:00Z',sourceUrl:'https://example.org/road',phase:'before listed kickoff',action:'Confirm active status with road agency.',status:'unreviewed_source_cue'}],note:'Source-linked verification tasks, not threats.'};
  const report=buildNflPublicReport(withQueue);
  assert.match(report,/## Analyst verification queue/);
  assert.match(report,/Confirm active status with road agency/);
  assert.match(report,/Publisher record\]\(https:\/\/example.org\/road\)/);
  assert.match(report,/not threats/);
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

test('AT&T Stadium report labels publisher-visible Arlington call count as delayed context',()=>{
  const arlington=structuredClone(bundle);
  arlington.venue.id='3687';
  arlington.picture.sources.push({name:'Local police activity',sourceUrl:'https://policeincidents.arlingtontx.gov/'});
  arlington.publicObservations.policeAggregate={nearby:26,radiusKm:5,sourceLatestAt:Date.parse('2026-10-10T05:40:00Z'),sourceLagMinutes:10};
  arlington.sourceSnapshots.police='2026-10-10T05:50:00Z';
  const report=buildNflPublicReport(arlington);
  assert.match(report,/Arlington delayed public police-call listing/);
  assert.match(report,/at least 60 minutes/);
  assert.match(report,/26/);
  assert.doesNotMatch(report,/## Delayed public safety context/);
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

test('selected-game direct check is timestamped and distinct from published game state',()=>{
  const checked=structuredClone(bundle);
  checked.publicObservations.selectedGameDirectCheck={state:'checked',checkedAt:'2026-10-10T02:00:00Z',sourceStatus:'Final',sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401872990',gameState:{away:{name:'Away',score:24},home:{name:'Home',score:16}},reportedAttendance:92351,scheduleDiffers:false,article:null};
  const report=buildNflPublicReport(checked);
  assert.match(report,/Selected-game direct publisher check/);
  assert.match(report,/Reported attendance:\*\* 92351/);
  assert.match(report,/publisher observations, not verified venue operations or threat findings/);
});

test('USGS report separates a successful empty sample from an unavailable feed',()=>{
  const checked=structuredClone(bundle);
  checked.picture.usgsContext={state:'current_snapshot',asOf:'2026-10-10T01:00:00Z',publisherAt:'2026-10-10T00:59:00Z',sourceUrl:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',events:[]};
  checked.sourceSnapshots.usgs=checked.picture.usgsContext.asOf;
  checked.publicObservations.earthquakes=[];
  assert.match(buildNflPublicReport(checked),/No nearby magnitude 2\.5\+ record in the bounded weekly sample\. This is not an all-clear/);
  const failed=structuredClone(checked);
  failed.picture.usgsContext={...checked.picture.usgsContext,state:'stale_or_unavailable',asOf:null};
  failed.sourceSnapshots.usgs=null;
  assert.match(buildNflPublicReport(failed),/Current USGS regional events are unavailable or stale; no negative finding follows/);
});
