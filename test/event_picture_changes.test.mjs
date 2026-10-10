import test from 'node:test';
import assert from 'node:assert/strict';
import {diffEventPicture} from '../site/event_picture_changes.js';

const source=(name,state)=>({name,state,sourceUrl:'https://agency.example/feed'});
const game={kickoff:'2026-10-11T17:00:00Z',status:'scheduled',timeTbd:false,sourceUrl:'https://league.example/game'};
const weatherCue={type:'weather alert',title:'NWS warning',basis:'Published window overlaps event',sourceUrl:'https://weather.example/alert',sourceAt:'2026-10-11T16:00:00Z'};
const picture=(state,cues=[])=>({eventId:'nfl:test',sources:[source('NWS point alerts',state)],cues});

test('new Houston corridor RSS item is observed only across newer complete feed checks',()=>{
  const url='https://traffic.houstontranstar.org/data/rss/incidents_rss.xml';
  const item={id:'1854994_Verified',title:'IH-610 South Loop Eastbound Before Scott St - Stall',sourceTextSha256:'a'.repeat(64),sourceUrl:url};
  const context=(at,entries,state='current_corridor_text_sample')=>({state,feeds:[{kind:'incidents',state:'current_corridor_text_sample',asOf:at,entries}]});
  const before={...picture('checked'),houstonTranstarContext:context('2026-10-24T12:00:00Z',[])};
  const after={...picture('checked'),houstonTranstarContext:context('2026-10-24T13:00:00Z',[item])};
  const change=diffEventPicture(before,after,null,null,game,game).find(row=>row.kind==='houston_corridor_rss_changed');
  assert.equal(change?.sourceUrl,url);
  assert.match(change.detail,/no item coordinates or verified stadium route/);
  assert.equal(diffEventPicture({...before,houstonTranstarContext:context('2026-10-24T12:00:00Z',[],'stale_or_unavailable')},after,null,null,game,game).some(row=>row.kind==='houston_corridor_rss_changed'),false);
});

test('newer AZ511 regional advisory text creates a review change only across current checks',()=>{
  const url='https://az511.gov/List/Alerts';
  const before={eventId:'nfl:401872991',sources:[{name:'AZ511 public regional alerts',state:'current_date_matched_regional_notice',sourceUrl:url}],cues:[{type:'regional road advisory',sourceId:'az511:aaaa',title:'Phoenix freeway advisory',basis:'Regional corridor notice',sourceUrl:url,sourceAt:'2026-10-08T20:45:00Z'}]};
  const after={...before,cues:[{...before.cues[0],sourceId:'az511:bbbb'}]};
  const item=diffEventPicture(before,after,null,null,game,game).find(change=>change.kind==='newly_displayed_cue');
  assert.equal(item?.sourceUrl,url);
  assert.match(item.detail,/not a confirmed venue impact or threat/);
  assert.equal(diffEventPicture({...before,sources:[{...before.sources[0],state:'stale_or_unavailable'}]},after,null,null,game,game).some(change=>change.kind==='newly_displayed_cue'),false);
});

test('Nashville OEM release additions require newer successful checks',()=>{
  const url='https://www.nashville.gov/departments/emergency-management/news/stadium-advisory';
  const base={state:'current_newsroom_check',sourceUrl:'https://www.nashville.gov/departments/emergency-management/news',asOf:'2026-10-10T05:00:00Z',recent:[]};
  const before={...picture('checked'),nashvilleOemNewsContext:base};
  const after={...picture('checked'),nashvilleOemNewsContext:{...base,asOf:'2026-10-10T06:00:00Z',recent:[{title:'City advisory',publishedAt:'2026-10-10T05:30:00Z',url}]}};
  const titans={...game,venue:{id:'3810'}};
  const changes=diffEventPicture(before,after,null,null,titans,titans);
  assert.equal(changes.find(item=>item.kind==='city_release_published')?.sourceUrl,url);
  assert.match(changes.find(item=>item.kind==='city_release_published')?.detail,/not a live alert/);
  assert.equal(diffEventPicture({...before,nashvilleOemNewsContext:{...base,state:'stale_or_unavailable'}},after,null,null,titans,titans).some(item=>item.kind==='city_release_published'),false);
});

test('revised exact-game NDOT permit is a planning change, never an observed closure',()=>{
  const url='https://www.nashville.gov/sites/default/files/2026-10/ROWConstructionRoadClosures-Weekof_101026-101726.pdf?ct=1791578264';
  const permit={permitNumber:'2026081013',street:'TITANS WAY',sourceUrl:url,sourceTextSha256:'a'.repeat(64)};
  const before={...picture('checked'),nashvilleTitansClosureContext:{state:'current_published_plan',asOf:'2026-10-10T05:00:00Z',entries:[permit,...Array.from({length:6},(_,i)=>({...permit,permitNumber:`20260810${20+i}`}))]}};
  const after={...picture('checked'),nashvilleTitansClosureContext:{state:'current_published_plan',asOf:'2026-10-10T06:00:00Z',entries:[{...permit,sourceTextSha256:'b'.repeat(64)},...before.nashvilleTitansClosureContext.entries.slice(1)]}};
  const titans={...game,id:'nfl:401872984'};
  const change=diffEventPicture(before,after,null,null,titans,titans).find(item=>item.kind==='planned_road_permit_revised');
  assert.equal(change?.sourceUrl,url);
  assert.match(change.detail,/not an observed closure or threat/);
});

test('WeGo stadium notice revisions require a newer operator check',()=>{
  const notice={state:'current_operator_notice',asOf:'2026-10-10T05:00:00Z',sourceUrl:'https://www.wegotransit.com/ride/alerts/',sourceTextSha256:'a'.repeat(64)};
  const before={...picture('checked'),wegoTitansAlertContext:notice};
  const after={...picture('checked'),wegoTitansAlertContext:{...notice,asOf:'2026-10-10T06:00:00Z',sourceTextSha256:'b'.repeat(64)}};
  const titans={...game,id:'nfl:401872984'};
  const change=diffEventPicture(before,after,null,null,titans,titans).find(item=>item.kind==='operator_service_notice_revised');
  assert.equal(change?.sourceUrl,notice.sourceUrl);
  assert.equal(diffEventPicture({...before,wegoTitansAlertContext:{...notice,state:'stale_or_unavailable'}},after,null,null,titans,titans).some(item=>item.kind==='operator_service_notice_revised'),false);
});

test('new source cue is linked only across comparable current checks',()=>{
  const changes=diffEventPicture(picture('checked'),picture('checked',[weatherCue]),null,null,game,game);
  assert.equal(changes.length,1);
  assert.equal(changes[0].kind,'newly_displayed_cue');
  assert.equal(changes[0].sourceUrl,weatherCue.sourceUrl);
  assert.match(changes[0].detail,/not a confirmed venue impact or threat/);
  assert.equal(diffEventPicture(picture('source failed'),picture('checked',[weatherCue]),null,null,game,game).filter(item=>item.kind==='newly_displayed_cue').length,0);
});

test('official game-announcement passage revisions require two newer checked snapshots',()=>{
  const url='https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026';
  const claim={id:'flyover',category:'aviation',sourceUrl:url,sourceTextSha256:'a'.repeat(64)};
  const before={...picture('checked'),packersReleaseContext:{state:'current_published_announcements',asOf:'2026-10-10T05:00:00Z',claims:[claim]}};
  const after={...picture('checked'),packersReleaseContext:{state:'current_published_announcements',asOf:'2026-10-10T06:00:00Z',claims:[{...claim,sourceTextSha256:'b'.repeat(64)}]}};
  const item=diffEventPicture(before,after,null,null,game,game).find(change=>change.kind==='club_announcement_revised');
  assert.equal(item?.sourceUrl,url);
  assert.match(item.detail,/not confirmed person attendance/);
  assert.equal(diffEventPicture({...before,packersReleaseContext:{...before.packersReleaseContext,state:'stale_or_unavailable'}},after,null,null,game,game).some(change=>change.kind==='club_announcement_revised'),false);
});

test('Jets and Patriots passage revisions surface without claiming a cancelled event',()=>{
  const cases=[
    {eventId:'nfl:401872983',key:'jetsGuideContext',url:'https://www.newyorkjets.com/fans/gameday-guide-2026',state:'current_published_plan',id:'entry'},
    {eventId:'nfl:401872986',key:'patriotsPreviewContext',url:'https://www.patriots.com/news/game-preview-patriots-vs-raiders-nfl-week-5',state:'current_published_announcements',id:'vinatieri_halftime'},
    {eventId:'nfl:401872992',key:'seahawksGuideContext',url:'https://www.seahawks.com/game-day/',state:'current_published_plan',id:'flyover'}
  ];
  for(const spec of cases){
    const claim={id:spec.id,category:'announced_person',sourceUrl:spec.url,sourceTextSha256:'a'.repeat(64)};
    const base={eventId:spec.eventId,sources:[],cues:[]};
    const before={...base,[spec.key]:{state:spec.state,asOf:'2026-10-10T05:00:00Z',sourceUrl:spec.url,claims:[claim]}};
    const after={...base,[spec.key]:{state:spec.state,asOf:'2026-10-10T06:00:00Z',sourceUrl:spec.url,claims:[{...claim,sourceTextSha256:'b'.repeat(64)}]}};
    const changed=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='club_passage_revised');
    assert.equal(changed?.sourceUrl,spec.url);
    assert.match(changed.detail,/not verified attendance/);
    const partial={...after,[spec.key]:{...after[spec.key],state:spec.eventId==='nfl:401872986'?'partial_published_announcements':'partial_published_plan',claims:[]}};
    const missing=diffEventPicture(before,partial,null,null,game,game).find(item=>item.kind==='club_passage_unmatched');
    assert.match(missing?.detail||'',/does not prove the plan was cancelled/);
    assert.equal(diffEventPicture({...before,[spec.key]:{...before[spec.key],state:'stale_or_unavailable'}},after,null,null,game,game).some(item=>item.kind==='club_passage_revised'),false);
  }
});

test('NASA regional point changes require two current snapshots and preserve provenance',()=>{
  const point={id:'EONET_42',title:'Wildfire example',distanceKm:68,sourceAt:'2026-10-10T01:00:00Z',sourceUrl:'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_42/geojson'};
  const before={...picture('checked'),naturalEventsContext:{state:'current_snapshot',events:[]}};
  const after={...picture('checked'),naturalEventsContext:{state:'current_snapshot',events:[point]}};
  const added=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='new_natural_event_point');
  assert.equal(added?.sourceUrl,point.sourceUrl);
  assert.match(added.detail,/does not establish current conditions, venue impact, or a threat/);
  assert.equal(diffEventPicture({...before,naturalEventsContext:{state:'stale_or_unavailable',events:[]}},after,null,null,game,game).some(item=>item.kind==='new_natural_event_point'),false);
  assert.equal(diffEventPicture(after,{...after,naturalEventsContext:{state:'current_snapshot',events:[{...point,sourceAt:'2026-10-10T02:00:00Z'}]}},null,null,game,game).find(item=>item.kind==='natural_event_point_updated')?.sourceUrl,point.sourceUrl);
});

test('USGS nearby earthquake changes require two successful newer checks',()=>{
  const quake={sourceId:'usgs-1',title:'M 3.0 synthetic',magnitude:3,distanceKm:41,occurredAt:'2026-10-10T01:00:00Z',updatedAt:'2026-10-10T01:05:00Z',sourceUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/usgs-1'};
  const before={...picture('checked'),usgsContext:{state:'current_snapshot',asOf:'2026-10-10T01:10:00Z',events:[]}};
  const after={...picture('checked'),usgsContext:{state:'current_snapshot',asOf:'2026-10-10T01:20:00Z',events:[quake]}};
  const change=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='new_usgs_earthquake');
  assert.equal(change?.sourceUrl,quake.sourceUrl);
  assert.match(change.detail,/does not establish stadium impact or a threat/);
  assert.equal(diffEventPicture({...before,usgsContext:{state:'unavailable',asOf:null,events:[]}},after,null,null,game,game).some(item=>item.kind==='new_usgs_earthquake'),false);
  assert.equal(diffEventPicture(before,{...after,usgsContext:{...after.usgsContext,asOf:before.usgsContext.asOf}},null,null,game,game).some(item=>item.kind==='new_usgs_earthquake'),false);
  const revised={...after,usgsContext:{...after.usgsContext,asOf:'2026-10-10T01:30:00Z',events:[{...quake,magnitude:3.2,updatedAt:'2026-10-10T01:25:00Z'}]}};
  assert.equal(diffEventPicture(after,revised,null,null,game,game).find(item=>item.kind==='usgs_earthquake_revised')?.sourceUrl,quake.sourceUrl);
});

test('NIFC change feed distinguishes a new bounded point from a material source revision',()=>{
  const point={id:42,name:'Example Fire',distanceKm:12,lat:34,lon:-118,updatedAt:'2026-10-10T01:00:00Z',acres:10,containedPercent:20,sourceUrl:'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/42'};
  const before={...picture('checked'),wildfireContext:{state:'current_snapshot',asOf:'2026-10-10T01:10:00Z',events:[]}};
  const after={...picture('checked'),wildfireContext:{state:'current_snapshot',asOf:'2026-10-10T02:10:00Z',events:[point]}};
  const added=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='new_wildfire_point');
  assert.equal(added?.sourceUrl,point.sourceUrl);
  assert.match(added.detail,/not a perimeter, smoke measurement, venue impact, or threat finding/);
  assert.equal(diffEventPicture({...before,wildfireContext:{...before.wildfireContext,state:'stale_or_unavailable'}},after,null,null,game,game).some(item=>item.kind==='new_wildfire_point'),false);
  const stamp={...point,updatedAt:'2026-10-10T02:00:00Z'};
  assert.equal(diffEventPicture(after,{...after,wildfireContext:{...after.wildfireContext,asOf:'2026-10-10T03:10:00Z',events:[stamp]}},null,null,game,game).some(item=>item.kind==='wildfire_point_revised'),false);
  const revised={...stamp,acres:20};
  assert.equal(diffEventPicture(after,{...after,wildfireContext:{...after.wildfireContext,asOf:'2026-10-10T03:10:00Z',events:[revised]}},null,null,game,game).find(item=>item.kind==='wildfire_point_revised')?.sourceUrl,point.sourceUrl);
});

test('EPA PM2.5 change feed uses dated same-station values and a review threshold',()=>{
  const sourceUrl='https://ofmpub.epa.gov/rsig/rsigserver?SERVICE=wcs&COVERAGE=airnow.pm25';
  const station={stationId:'123',pm25UgM3:5,distanceKm:12,observedAt:'2026-10-10T01:00:00Z',sourceUrl};
  const before={...picture('checked'),airQualityContext:{state:'current_station_observation',asOf:'2026-10-10T01:10:00Z',sourceUrl,observation:station}};
  const next={...before,airQualityContext:{...before.airQualityContext,asOf:'2026-10-10T02:10:00Z',observation:{...station,pm25UgM3:11,observedAt:'2026-10-10T02:00:00Z'}}};
  const changed=diffEventPicture(before,next,null,null,game,game).find(item=>item.kind==='pm25_observation_changed');
  assert.equal(changed?.sourceUrl,sourceUrl);
  assert.match(changed.detail,/product review filter, not a health threshold/);
  const small={...next,airQualityContext:{...next.airQualityContext,observation:{...next.airQualityContext.observation,pm25UgM3:8}}};
  assert.equal(diffEventPicture(before,small,null,null,game,game).some(item=>item.kind==='pm25_observation_changed'),false);
  assert.equal(diffEventPicture({...before,airQualityContext:{...before.airQualityContext,state:'stale_or_unavailable'}},next,null,null,game,game).some(item=>item.kind==='pm25_observation_changed'),false);
  assert.equal(diffEventPicture(before,{...next,airQualityContext:{...next.airQualityContext,observation:{...next.airQualityContext.observation,observedAt:station.observedAt}}},null,null,game,game).some(item=>item.kind==='pm25_observation_changed'),false);
  const moved={...next,airQualityContext:{...next.airQualityContext,observation:{...next.airQualityContext.observation,stationId:'456'}}};
  assert.equal(diffEventPicture(before,moved,null,null,game,game).find(item=>item.kind==='pm25_station_changed')?.sourceUrl,sourceUrl);
});

test('NOAA smoke point matches require two newer daily analyses',()=>{
  const sourceUrl='https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML/2026/10/hms_smoke20261009.kml';
  const polygon={polygonIndex:3,density:'light',startAt:'2026-10-09T16:00:00Z',endAt:'2026-10-09T20:00:00Z',sourceUrl};
  const before={...picture('checked'),smokeContext:{state:'recent_daily_analysis',asOf:'2026-10-10T01:00:00Z',sourceUrl,polygons:[]}};
  const after={...picture('checked'),smokeContext:{state:'recent_daily_analysis',asOf:'2026-10-10T02:00:00Z',sourceUrl,polygons:[polygon]}};
  const change=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='new_satellite_smoke_match');
  assert.equal(change?.sourceUrl,sourceUrl);
  assert.match(change.detail,/not a ground-level concentration/);
  assert.equal(diffEventPicture({...before,smokeContext:{...before.smokeContext,state:'stale_or_unavailable'}},after,null,null,game,game).some(item=>item.kind==='new_satellite_smoke_match'),false);
  assert.equal(diffEventPicture(after,{...after,smokeContext:{...after.smokeContext,asOf:'2026-10-10T03:00:00Z'}},null,null,game,game).some(item=>item.kind==='new_satellite_smoke_match'),false);
});

test('new smoke and nearby station time overlap is a source-linked review change',()=>{
  const sourceUrl='https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML/2026/10/hms_smoke20261009.kml';
  const air={state:'current_station_observation',asOf:'2026-10-10T01:00:00Z'};
  const before={...picture('checked'),smokeContext:{state:'recent_daily_analysis',asOf:'2026-10-10T01:00:00Z'},airQualityContext:air,environmentalCorrelation:{state:'no_polygon_point_match'}};
  const after={...before,smokeContext:{state:'recent_daily_analysis',asOf:'2026-10-10T02:00:00Z'},environmentalCorrelation:{state:'same_published_time_window',smokeSourceUrl:sourceUrl,stationObservedAt:'2026-10-09T18:00:00Z',stationDistanceKm:6}};
  const change=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='smoke_pm25_time_overlap');
  assert.equal(change?.sourceUrl,sourceUrl);
  assert.match(change.detail,/not source attribution/);
  assert.equal(diffEventPicture({...before,smokeContext:{...before.smokeContext,state:'stale_or_unavailable'}},after,null,null,game,game).some(item=>item.kind==='smoke_pm25_time_overlap'),false);
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

test('Green Bay city notice changes require two newer complete category checks',()=>{
  const notice={kind:'police',title:'City notice',detail:'Public city update',url:'https://www.greenbaywi.gov/AlertCenter.aspx?AID=123',publishedAt:'2026-10-10T06:00:00Z'};
  const before={...picture('checked'),greenBayAlertContext:{state:'current_snapshot',asOf:'2026-10-10T06:10:00Z',alerts:[]}};
  const after={...before,greenBayAlertContext:{state:'current_snapshot',asOf:'2026-10-10T06:20:00Z',alerts:[notice]}};
  const found=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='new_city_notice');
  assert.equal(found?.sourceUrl,notice.url);
  assert.match(found.detail,/not a stadium incident/);
  assert.equal(diffEventPicture({...before,greenBayAlertContext:{...before.greenBayAlertContext,state:'partial'}},after,null,null,game,game).some(item=>item.kind==='new_city_notice'),false);
});

test('venue plan text changes require comparable newer complete checks',()=>{
  const sourceUrl='https://www.packers.com/lambeau-field/gameday-information';
  const ids=['gates','oneida','lombardi','postgame','bus','rideshare'];
  const claims=ids.map(id=>({id,topic:id,sourceTextSha256:'a'.repeat(64)}));
  const before={...picture('checked'),lambeauPlanContext:{state:'current_published_plan',asOf:'2026-10-10T06:00:00Z',sourceUrl,claims}};
  const after={...before,lambeauPlanContext:{state:'current_published_plan',asOf:'2026-10-10T07:00:00Z',sourceUrl,claims:[{...claims[0],sourceTextSha256:'b'.repeat(64)},...claims.slice(1)]}};
  const change=diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='venue_plan_revised');
  assert.equal(change?.sourceUrl,sourceUrl);
  assert.match(change.detail,/gates changed/);
  assert.equal(diffEventPicture({...before,lambeauPlanContext:{...before.lambeauPlanContext,state:'partial_published_plan'}},after,null,null,game,game).some(item=>item.kind==='venue_plan_revised'),false);
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
  const article={title:'Bears at Packers preview',publisher:'CBS Sports',matchBasis:'both_teams_in_title',publishedAt:'2026-10-10T00:00:00Z',url:'https://www.cbssports.com/nfl/news/example'};
  const current={state:'current_snapshot',articles:[article]};
  const empty={state:'current_snapshot',articles:[]};
  assert.equal(diffEventPicture(picture('checked'),picture('checked'),empty,current,game,game)[0].kind,'newly_displayed_headline');
  assert.equal(diffEventPicture(picture('checked'),picture('checked'),{state:'unavailable',articles:[]},current,game,game).length,0);
  assert.equal(diffEventPicture(picture('checked'),picture('checked'),empty,{...current,articles:[{...article,matchBasis:'one_team_mentioned'}]},game,game).length,0);
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
