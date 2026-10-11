import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';

const now=Date.parse('2026-10-09T18:00:00Z');
const game={id:'nfl:demo',kickoff:'2026-10-11T20:00:00Z',timeTbd:false,status:'scheduled in source',sourceRetrievedAt:'2026-10-09T17:55:00Z',venue:{id:'3687',lat:32.747,lon:-97.094}};
const inputs={schedule:{builtAt:'2026-10-09T17:55:00Z'},ground:{byVenue:{3687:{sourceEditedAt:'2026-09-01T00:00:00Z',identityMethod:'wikidata'}}},airspace:{builtAt:'2026-10-09T17:50:00Z',byGame:{'nfl:demo':{sourceUpdatedAt:'2026-10-09T16:00:00Z'}}},cameras:{builtAt:'2026-10-09T17:50:00Z',byVenue:{3687:[]}},roads:{builtAt:'2026-10-09T17:50:00Z',coverageFrom:'2026-10-09T17:00:00Z',coverageThrough:'2026-10-16T17:00:00Z',byVenue:{3687:[{id:'road:1',kind:'Closure',name:'Example Road',agency:'Agency',distanceKm:2,startAt:'2026-10-11T19:00:00Z',endAt:'2026-10-11T22:00:00Z',sourceUrl:'https://example.gov/road/1'}]}},conditions:{at:now,alerts:{features:[{id:'nws:1',properties:{event:'Severe thunderstorm',severity:'Severe',urgency:'Immediate',status:'Actual',effective:'2026-10-11T19:00:00Z',expires:'2026-10-11T21:00:00Z','@id':'https://api.weather.gov/alerts/1'}}]}},police:{state:'retrieved',checkedAt:now,context:{nearby:1}}};

test('event picture preserves source-linked review cues without making a threat assessment',()=>{
  const picture=buildNflEventPicture(game,inputs,now);
  assert.equal(picture.cueCounts.weather,1);
  assert.equal(picture.cueCounts.road,1);
  assert.equal(picture.cues.length,2);
  assert.equal(picture.cues[0].sourceUrl,'https://api.weather.gov/alerts/1');
  assert.equal(picture.cues[1].sourceUrl,'https://example.gov/road/1');
  assert.equal(picture.reviewQueue.items.length,2);
  assert.equal(picture.reviewQueue.items[0].status,'unreviewed_source_cue');
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
  assert.ok(picture.gaps.some(gap=>gap.includes('stadium CCTV')));
  assert.equal(picture.zoneReview.find(zone=>zone.name==='Stadium ground perimeter').state,'unreviewed mapped candidate');
  assert.equal(picture.zoneReview.find(zone=>zone.name==='FAA event airspace').state,'source snapshot; NOTAM unverified');
  assert.equal(picture.zoneReview.find(zone=>zone.name==='Drone detections').state,'no connected detection source');
  assert.ok(picture.gaps.some(gap=>gap.includes('active jurisdictional police alert')));
});

test('malformed NWS alert payload remains a source failure in the event picture',()=>{
  const picture=buildNflEventPicture(game,{...inputs,conditions:{at:now,alerts:{features:null}}},now);
  assert.equal(picture.sources.find(item=>item.name==='NWS point alerts').state,'source failed');
  assert.equal(picture.cueCounts.weather,0);
});

test('Denver delayed crime aggregate appears as context without generating a threat cue',()=>{
  const denverGame={...game,venue:{id:'3937',lat:39.743888888,lon:-105.02}};
  const police={state:'retrieved',checkedAt:now,context:{nearby:4800,start:'2026-09-02',end:'2026-10-02',radiusKm:5,sourceLatestAt:now-24*3600000,sourceLagHours:24,checkedAt:now}};
  const picture=buildNflEventPicture(denverGame,{schedule:inputs.schedule,police},now);
  assert.equal(picture.policeContext.nearby,4800);
  assert.equal(picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  assert.equal(picture.cues.some(item=>item.sourceUrl?.includes('ODC_CRIME_OFFENSES_P')),false);
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
});

test('Glendale ZIP calls remain historical context rather than a stadium threat cue',()=>{
  const arizonaGame={...game,venue:{id:'3970',lat:33.5275,lon:-112.2625}};
  const police={state:'retrieved',checkedAt:now,context:{nearby:321,zip:'85305',start:'2026-10-01',end:'2026-10-08',sourceLatestAt:now-35*3600000,sourceLoadedAt:now-24*3600000,sourceLagHours:35}};
  const picture=buildNflEventPicture(arizonaGame,{schedule:inputs.schedule,police},now);
  assert.equal(picture.policeContext.nearby,321);
  assert.equal(picture.policeContext.zip,'85305');
  assert.equal(picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  assert.equal(picture.cues.some(item=>item.sourceUrl?.includes('Police_Calls_for_Service')),false);
  assert.ok(picture.gaps.some(item=>item.includes('ZIP-wide historical')));
});

test('AZ511 date-matched Phoenix notice enters review without claiming a road impact',()=>{
  const checkAt='2026-10-09T17:55:00Z';
  const arizonaGame={...game,venue:{id:'3970',lat:33.5275,lon:-112.2625}};
  const az511PublicAlerts={schema:'event-atlas.az511-public-alerts.v1',status:'ok',checkedAt:checkAt,sourceUrl:'https://az511.gov/List/Alerts',entries:[{title:'Weekend freeway closures/restrictions in Phoenix area',notes:'PHOENIX - restrictions Friday, Oct. 9-Monday, Oct. 12. EB L-101 (Agua Fria Freeway) closed between 75th and 51st avenues.',updatedAt:'2026-10-08T20:45:00Z',localDateStart:'2026-10-09',localDateEnd:'2026-10-12',sourceTextSha256:'a'.repeat(64),sourceUrl:'https://az511.gov/List/Alerts'}]};
  const picture=buildNflEventPicture(arizonaGame,{schedule:inputs.schedule,az511PublicAlerts},now);
  assert.equal(picture.az511AlertContext.state,'current_date_matched_regional_notice');
  assert.equal(picture.sources.find(item=>item.name==='AZ511 public regional alerts').state,'current_date_matched_regional_notice');
  assert.ok(picture.cues.some(item=>item.type==='regional road advisory'));
  assert.equal(picture.cueCounts.road,0);
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
});

test('Houston TranStar RSS enters Reliant briefing as corridor context only',()=>{
  const houstonGame={...game,venue:{id:'3891',lat:29.6847,lon:-95.4108}};
  const url='https://traffic.houstontranstar.org/data/rss/incidents_rss.xml';
  const houstonTranstarRss={schema:'event-atlas.houston-transtar-rss.v1',status:'partial',checkedAt:'2026-10-09T17:55:00Z',feeds:{incidents:{status:'ok',sourceAt:'2026-10-09T17:50:00Z',totalListed:1,corridorListed:1,sourceUrl:url,entries:[{id:'1854994_Verified',title:'IH-610 South Loop Eastbound Before Scott St - Stall',description:'Status: Verified at 12:45 PM',sourceAt:'2026-10-09T17:50:00Z',sourceTextSha256:'a'.repeat(64),sourceUrl:url}]},lane_closures:{status:'failed',sourceAt:null,totalListed:null,corridorListed:null,entries:[],sourceUrl:'https://traffic.houstontranstar.org/data/rss/laneclosures_rss.xml'}}};
  const picture=buildNflEventPicture(houstonGame,{schedule:inputs.schedule,houstonTranstarRss},now);
  assert.equal(picture.houstonTranstarContext.state,'partial_corridor_text_sample');
  assert.equal(picture.houstonTranstarContext.entries.length,1);
  assert.equal(picture.cues.length,0);
  assert.equal(picture.cueCounts.road,0);
  assert.ok(picture.gaps.some(item=>item.includes('TranStar incident or closure RSS coverage')));
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
});

test('Philadelphia citywide notices are cited as city context without event impact or threat cue',()=>{
  const phillyGame={...game,venue:{id:'3806',lat:39.90089,lon:-75.16776}};
  const context={state:'retrieved',checkedAt:now,totalReturned:1,invalidCount:0,sourceUrl:'https://api.phila.gov/phila/site-wide-alerts/v1',alerts:[{title:'City notice',detail:'Citywide information',url:'https://www.phila.gov/notice'}]};
  const picture=buildNflEventPicture(phillyGame,{schedule:inputs.schedule,phillyAlerts:{status:'retrieved',builtAt:new Date(now).toISOString(),context}},now);
  assert.equal(picture.citywideAlertsContext.alerts[0].title,'City notice');
  assert.equal(picture.sources.find(item=>item.name==='Philadelphia citywide notices').state,'citywide notices listed');
  assert.equal(picture.cues.some(item=>item.title==='City notice'),false);
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
});

test('Philadelphia permitted work is game-date planning context and never an observed road cue',()=>{
  const phillyGame={...game,venue:{id:'3806',lat:39.90089,lon:-75.16776}};
  const permits={status:'ok',builtAt:new Date(now).toISOString(),sourceUrl:'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/LaneClosure_Master/FeatureServer/0',byGame:{[game.id]:{gameDate:'2026-10-11',segmentCount:47,permitCount:19,nearest:[{permitNumber:'P-1',effective:'2026-10-01',expires:'2026-10-31',distanceKm:0.1}]}}};
  const picture=buildNflEventPicture(phillyGame,{schedule:inputs.schedule,phillyPermits:permits},now);
  assert.equal(picture.phillyPermitContext.permitCount,19);
  assert.equal(picture.sources.find(item=>item.name==='Philadelphia lane permits').state,'game-date permit candidates listed');
  assert.equal(picture.cues.some(item=>item.sourceUrl?.includes('LaneClosure_Master')),false);
  assert.equal(picture.cueCounts.road,0);
});

test('current SPC categorical forecast enters brief as an unassessed planning cue',()=>{
  const spc={status:'ok',builtAt:'2026-10-09T17:50:00Z',byVenue:{3687:[{day:3,category:'Marginal',categoryRank:3,validAt:'2026-10-11T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z',issuedAt:'2026-10-09T17:30:00Z',sourceUrl:'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/17'}]}};
  const picture=buildNflEventPicture(game,{...inputs,spc},now);
  assert.equal(picture.cueCounts.outlook,1);
  assert.equal(picture.convectiveOutlook.match.category,'Marginal');
  assert.ok(picture.cues.some(item=>item.type==='convective outlook'&&item.sourceUrl.includes('weather.noaa.gov')));
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
});

test('current kickoff forecast enters source status without becoming a threat cue',()=>{
  const forecast={state:'ok',checkedAt:now,kickoff:game.kickoff,sourceUrl:'https://api.weather.gov/gridpoints/FWD/82,107/forecast/hourly',period:{startTime:'2026-10-11T19:00:00Z',endTime:'2026-10-11T21:00:00Z',shortForecast:'Partly Cloudy',temperature:78,temperatureUnit:'F',windSpeed:'10 mph',windDirection:'S',probabilityOfPrecipitation:{value:20}}};
  const picture=buildNflEventPicture(game,{...inputs,forecast},now);
  assert.equal(picture.forecastContext.state,'current forecast');
  assert.equal(picture.sources.find(item=>item.name==='NWS kickoff forecast').sourceUrl,forecast.sourceUrl);
  assert.equal(picture.cues.length,2);
  assert.ok(!picture.gaps.some(item=>item.includes('hourly kickoff forecast')));
});

test('nearby station measurement enters source context without becoming a threat cue',()=>{
  const observation={state:'current_station_observation',checkedAt:new Date(now).toISOString(),observedAt:new Date(now-20*60000).toISOString(),stationId:'KDFW',stationName:'Dallas Fort Worth Airport',distanceKm:18.2,description:'Cloudy',temperatureC:24,windKmh:8,humidityPercent:58,sourceUrl:'https://api.weather.gov/stations/KDFW/observations/2026-10-09T17:40:00+00:00',interpretation:'Nearby station, not at stadium.'};
  const picture=buildNflEventPicture(game,{...inputs,conditions:{...inputs.conditions,observation}},now);
  assert.equal(picture.observationContext.stationId,'KDFW');
  assert.equal(picture.sources.find(item=>item.name==='NWS nearby station observation').sourceUrl,observation.sourceUrl);
  assert.equal(picture.cues.length,2);
  assert.equal(picture.gaps.some(item=>item.includes('nearby NWS station')),false);
  const stale=buildNflEventPicture(game,{...inputs,conditions:{...inputs.conditions,observation:{...observation,checkedAt:new Date(now-11*60000).toISOString()}}},now);
  assert.equal(stale.observationContext,null);
  assert.ok(stale.gaps.some(item=>item.includes('nearby NWS station')));
});

test('live game labels the current hourly forecast separately from the kickoff forecast',()=>{
  const liveNow=Date.parse('2026-10-11T21:15:00Z');
  const liveGame={...game,status:'in progress in source'};
  const forecast={state:'ok',checkedAt:liveNow,kickoff:game.kickoff,sourceUrl:'https://api.weather.gov/gridpoints/FWD/82,107/forecast/hourly',period:{startTime:'2026-10-11T21:00:00Z',endTime:'2026-10-11T22:00:00Z',shortForecast:'Light Rain',temperature:69,temperatureUnit:'F'}};
  const picture=buildNflEventPicture(liveGame,{...inputs,forecast},liveNow);
  assert.equal(picture.forecastContext.state,'current event-hour forecast');
  assert.equal(picture.sources.find(item=>item.name==='NWS event-hour forecast').sourceUrl,forecast.sourceUrl);
  assert.ok(!picture.gaps.some(item=>item.includes('current event-hour forecast')));
});

test('stale observations and unknown kickoff do not create time-aligned cues',()=>{
  const stale=buildNflEventPicture(game,{...inputs,roads:{...inputs.roads,builtAt:'2026-10-08T00:00:00Z'},conditions:{...inputs.conditions,at:now-3600000}},now);
  assert.equal(stale.cues.length,0);
  assert.equal(stale.cueCounts.weather,0);
  assert.equal(stale.cueCounts.road,0);
  const tbd=buildNflEventPicture({...game,timeTbd:true},inputs,now);
  assert.equal(tbd.cues.length,0);
  assert.ok(tbd.gaps.some(gap=>gap.includes('Road event-time matching')));
});

test('missing sources are gaps rather than zero-incident findings',()=>{
  const picture=buildNflEventPicture({...game,venue:{...game.venue,id:'other'}},{schedule:inputs.schedule},now);
  assert.equal(picture.cues.length,0);
  assert.equal(picture.sources.find(source=>source.name==='Local police activity').state,'no connector');
  assert.ok(picture.gaps.some(gap=>gap.includes('No jurisdictional police incident feed')));
  assert.equal(picture.zoneReview.find(zone=>zone.name==='Stadium ground perimeter').state,'no mapped candidate');
});

test('Superdome brief links only the official camera directory',()=>{
  const saints={...game,venue:{id:'3493',address:'New Orleans, LA, USA',lat:29.9509,lon:-90.0812}};
  const cameras={builtAt:new Date(now).toISOString(),sources:[{id:'la511-public-cameras',status:'directory_only',url:'https://511la.org/cctv'},{id:'txdot-dfw-camera-assets',status:'failed'}],byVenue:{}};
  const picture=buildNflEventPicture(saints,{schedule:inputs.schedule,cameras},now);
  assert.equal(picture.sources.find(item=>item.name==='Roadway cameras').state,'publisher directory only');
  assert.equal(picture.sources.find(item=>item.name==='Roadway cameras').sourceUrl,'https://511la.org/cctv');
  assert.equal(picture.sources.find(item=>item.name==='Roadway camera stream check'),undefined);
  assert.equal(picture.cues.length,0);
  assert.equal(picture.assessment.severity,'not_assessed');
});

test('Seattle closed-call context is labeled and never becomes a threat cue',()=>{
  const seattle={...game,venue:{...game.venue,id:'3673',lat:47.5952,lon:-122.3316}};
  const picture=buildNflEventPicture(seattle,{schedule:inputs.schedule,police:{state:'retrieved',checkedAt:now,context:{nearby:5}}},now);
  const source=picture.sources.find(item=>item.name==='Local police activity');
  assert.equal(source.state,'public call count checked');
  assert.match(source.detail,/closed CAD responses/);
  assert.equal(picture.cues.length,0);
  assert.equal(picture.assessment.severity,'not_assessed');
  assert.ok(!picture.gaps.some(gap=>gap.includes('No jurisdictional police incident feed')));
});

test('Chicago historical count stays a dated aggregate and never becomes a threat cue',()=>{
  const chicago={...game,venue:{...game.venue,id:'3933',lat:41.8625,lon:-87.6167}};
  const picture=buildNflEventPicture(chicago,{schedule:inputs.schedule,police:{state:'retrieved',sourceId:'chicago',checkedAt:now,context:{nearby:83,start:'2026-09-01',end:'2026-10-01',radiusKm:5,caseNumber:'private'}}},now);
  const source=picture.sources.find(item=>item.name==='Local police activity');
  assert.equal(source.state,'delayed historical count checked');
  assert.deepEqual(picture.policeContext,{nearby:83,start:'2026-09-01',end:'2026-10-01',radiusKm:5});
  assert.ok(picture.gaps.some(gap=>gap.includes('no active police alert feed')));
  assert.equal(picture.cues.length,0);
});

test('Indianapolis delayed calls remain historical context with no threat cue',()=>{
  const indy={...game,venue:{...game.venue,id:'3812',lat:39.760056,lon:-86.163806}};
  const context={nearby:123,start:'2026-10-01',end:'2026-10-08',radiusKm:5,sourceLatestAt:now-30*3600000,sourceLagHours:30,privateAddress:'must not export'};
  const picture=buildNflEventPicture(indy,{schedule:inputs.schedule,police:{state:'retrieved',sourceId:'indianapolis',checkedAt:now-2*3600000,context}},now);
  assert.equal(picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  assert.equal(picture.policeContext.nearby,123);
  assert.equal(picture.policeContext.privateAddress,undefined);
  assert.equal(picture.cues.length,0);
  assert.ok(picture.gaps.some(gap=>gap.includes('delayed seven-day aggregate')));
});

test('Charlotte delayed incident reports remain historical context with no threat cue',()=>{
  const charlotte={...game,venue:{...game.venue,id:'3628',lat:35.225833333,lon:-80.852777777}};
  const context={nearby:403,start:'2026-10-01',end:'2026-10-08',radiusKm:5,sourceLatestAt:now-45*3600000,sourceLagHours:45,privateAddress:'must not export'};
  const picture=buildNflEventPicture(charlotte,{schedule:inputs.schedule,police:{state:'retrieved',sourceId:'charlotte',checkedAt:now-2*3600000,context}},now);
  assert.equal(picture.sources.find(item=>item.name==='Local police activity').state,'delayed historical count checked');
  assert.equal(picture.policeContext.nearby,403);
  assert.equal(picture.policeContext.privateAddress,undefined);
  assert.equal(picture.cues.length,0);
  assert.ok(picture.gaps.some(gap=>gap.includes('noncriminal and potentially unfounded')));
});

test('Charlotte open CMPD roadway check is source context, not a police alert or threat cue',()=>{
  const charlotte={...game,venue:{...game.venue,id:'3628',lat:35.225833333,lon:-80.852777777}};
  const picture=buildNflEventPicture(charlotte,{schedule:inputs.schedule,cmpdTraffic:{state:'retrieved',checkedAt:now,totalOpen:12,nearby:2,invalidCount:0,newestNearbyAt:'2026-10-09T17:00:00Z',sourceUrl:'https://cmpdinfo.charlottenc.gov/api/v2.1/TrafficRSS',interpretation:'Open roadway context only',privateTitle:'Do not export'}},now);
  assert.equal(picture.sources.find(item=>item.name==='CMPD open roadway incidents').state,'open-feed count checked');
  assert.equal(picture.openRoadwayContext.nearby,2);
  assert.equal(picture.openRoadwayContext.privateTitle,undefined);
  assert.equal(picture.cues.length,0);
  assert.ok(picture.gaps.some(gap=>gap.includes('No active jurisdictional police alert')));
});

test('Foxboro station alert overlap is a transit review cue with bounded export',()=>{
  const foxboro={...game,venue:{...game.venue,id:'3738',lat:42.09094,lon:-71.26434}};
  const transit={state:'retrieved',checkedAt:now,stopId:'place-FS-0049',stopName:'Foxboro',stopDistanceKm:0.52,totalReturned:1,invalidCount:0,screenable:true,eventWindow:{start:'2026-10-11T16:00:00Z',end:'2026-10-12T01:00:00Z'},overlapCount:1,sourceUrl:'https://api-v3.mbta.com/alerts?filter%5Bstop%5D=place-FS-0049',interpretation:'Transit context only',alerts:[{id:'123',header:'Synthetic station shuttle',effect:'SHUTTLE',lifecycle:'UPCOMING',updatedAt:'2026-10-09T17:00:00Z',periods:[{start:'2026-10-11T18:00:00Z',end:'2026-10-11T22:00:00Z'}],eventWindowOverlap:true,sourceUrl:'https://api-v3.mbta.com/alerts/123',privateNote:'Do not export'}]};
  const picture=buildNflEventPicture(foxboro,{schedule:inputs.schedule,transit},now);
  assert.equal(picture.cueCounts.transit,1);
  assert.equal(picture.cues.length,1);
  assert.equal(picture.cues[0].type,'transit alert');
  assert.equal(picture.sources.find(item=>item.name==='MBTA Foxboro station alerts').state,'station alerts checked');
  assert.equal(picture.transitContext.alerts[0].privateNote,undefined);
  assert.equal(picture.assessment.severity,'not_assessed');
});

test('failed direct Tennessee road check is visible as a gap',()=>{
  const nashville={...game,venue:{...game.venue,id:'3810',lat:36.1663,lon:-86.7713}};
  const picture=buildNflEventPicture(nashville,{schedule:inputs.schedule,roadDirect:{state:'failed',checkedAt:now}},now);
  assert.ok(picture.gaps.some(gap=>gap.includes('Direct Tennessee DOT SmartWay check failed')));
  assert.equal(picture.cueCounts.road,0);
});

test('WPC rainfall forecast appears as a source-linked planning cue, not an assessed threat',()=>{
  const wpcRain={status:'ok',builtAt:new Date(now).toISOString(),sources:[{day:3,validAt:'2026-10-11T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z'}],byVenue:{[game.venue.id]:[{day:3,category:'Marginal',categoryRank:1,validAt:'2026-10-11T12:00:00Z',expiresAt:'2026-10-12T12:00:00Z',issuedAt:'2026-10-09T20:05:00Z',sourceUrl:'https://mapservices.weather.noaa.gov/vector/rest/services/hazards/wpc_precip_hazards/MapServer/2'}]}};
  const picture=buildNflEventPicture(game,{schedule:inputs.schedule,wpcRain},now);
  assert.equal(picture.cueCounts.rainfall,1);
  assert.equal(picture.cues.find(item=>item.type==='excessive rainfall outlook').sourceAt,'2026-10-09T20:05:00Z');
  assert.equal(picture.sources.find(item=>item.name==='NOAA WPC excessive-rainfall outlook').state,'published outlook at kickoff');
  assert.equal(picture.assessment.severity,'not_assessed');
});

 test('second-week road windows enter assessment while expired weather never becomes a game-day finding',()=>{
 const later={...game,kickoff:'2026-10-21T20:00:00Z'};
 const roads={...inputs.roads,coverageThrough:'2026-10-23T18:00:00Z',byVenue:{3687:[{...inputs.roads.byVenue[3687][0],startAt:'2026-10-21T19:00:00Z',endAt:'2026-10-21T22:00:00Z'}]}};
 const picture=buildNflEventPicture(later,{...inputs,roads},now);
 assert.equal(picture.reviewQueue.state,'review_candidates');
 assert.equal(picture.reviewQueue.items.filter(c=>c.domain==='road access').length,1);
 assert.equal(picture.reviewQueue.items.filter(c=>c.domain==='weather alert').length,0);
 });

test('game briefing removes ended weather and roadway concerns without discarding source context',()=>{
 const liveNow=Date.parse('2026-10-11T21:00:00Z');
 const liveGame={...game,status:'in progress in source'};
 const liveInputs={...inputs,roads:{...inputs.roads,builtAt:new Date(liveNow).toISOString(),byVenue:{3687:[{...inputs.roads.byVenue[3687][0],endAt:new Date(liveNow).toISOString()}]}},conditions:{at:liveNow,alerts:{features:[{properties:{status:'Actual',effective:'2026-10-11T19:00:00Z',ends:new Date(liveNow).toISOString(),expires:'2026-10-12T01:00:00Z',severity:'Severe',urgency:'Immediate','@id':'https://api.weather.gov/alerts/ended'}}]}}};
 const picture=buildNflEventPicture(liveGame,liveInputs,liveNow);
 assert.equal(picture.cueCounts.weather,0);assert.equal(picture.cueCounts.road,0);
 assert.equal(picture.reviewQueue.items.filter(c=>['weather alert','road access'].includes(c.domain)).length,0);
 assert.ok(picture.sources.some(s=>s.name==='NWS point alerts'&&s.state==='checked'));
});
