import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublishedReportState,retainPublishedChanges} from '../site/published_report_changes.js';

const at=Date.parse('2026-10-10T02:00:00Z');
const game={id:'nfl:123',kickoff:'2026-10-11T17:00:00Z',status:'scheduled',timeTbd:false,sourceUrl:'https://www.espn.com/nfl/game/_/gameId/123'};
const source=state=>({name:'NWS point alerts',state,sourceUrl:'https://api.weather.gov/alerts/active'});
const cue={type:'weather alert',title:'Publisher warning',basis:'Published window overlaps event',sourceUrl:'https://api.weather.gov/alerts/123',sourceAt:'2026-10-11T16:00:00Z'};
const bundle=(state,cues=[])=>({picture:{eventId:game.id,sources:[source(state)],cues,forecastContext:{state:'unavailable or stale'}}});

test('published change state starts at a baseline and records only comparable new cues',()=>{
  const baseline=buildPublishedReportState(bundle('checked'),game,null,null,at-3600000);
  assert.equal(baseline.newChangeCount,0);
  assert.match(baseline.comparison,/baseline/);
  const next=buildPublishedReportState(bundle('checked',[cue]),game,null,baseline,at);
  assert.equal(next.newChangeCount,1);
  assert.equal(next.changes[0].kind,'newly_displayed_cue');
  assert.equal(next.changes[0].sourceUrl,cue.sourceUrl);
  const repeated=buildPublishedReportState(bundle('checked',[cue]),game,null,next,at+3600000);
  assert.equal(repeated.newChangeCount,0);
  assert.equal(repeated.changes.length,1);
});

test('failed checks and changed schedules do not claim a new source cue or clearance',()=>{
  const baseline=buildPublishedReportState(bundle('source failed'),game,null,null,at-3600000);
  const recovered=buildPublishedReportState(bundle('checked',[cue]),game,null,baseline,at);
  assert.equal(recovered.changes.filter(item=>item.kind==='newly_displayed_cue').length,0);
  assert.equal(recovered.changes[0].kind,'source_status_changed');
  const moved={...game,kickoff:'2026-10-11T21:00:00Z'};
  const rescheduled=buildPublishedReportState(bundle('checked',[cue]),moved,null,baseline,at);
  assert.equal(rescheduled.changes.find(item=>item.kind==='schedule_changed')?.sourceUrl,game.sourceUrl);
  assert.equal(rescheduled.changes.filter(item=>item.kind==='newly_displayed_cue').length,0);
});

test('stale or mismatched prior state cannot be treated as a comparison',()=>{
  const baseline=buildPublishedReportState(bundle('checked'),game,null,null,at-15*86400000);
  const next=buildPublishedReportState(bundle('checked',[cue]),game,null,baseline,at);
  assert.equal(next.newChangeCount,0);
  assert.match(next.comparison,/baseline/);
  const mismatched={...baseline,eventId:'nfl:other'};
  assert.equal(buildPublishedReportState(bundle('checked',[cue]),game,null,mismatched,at-14*86400000).newChangeCount,0);
});

test('published runs record changes in an identity-checked direct game result',()=>{
  const checkedAt='2026-10-10T01:00:00Z';
  const direct={state:'checked',checkedAt,sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=123',sourceStatus:'Scheduled',gameState:null,reportedAttendance:null,article:null,scheduleDiffers:false};
  const initial=bundle('checked');
  initial.picture.directGame=direct;
  const baseline=buildPublishedReportState(initial,game,null,null,at-3600000);
  const changed=bundle('checked');
  changed.picture.directGame={...direct,checkedAt:'2026-10-10T02:00:00Z',sourceStatus:'In Progress',gameState:{phase:'in progress',home:{name:'Home',score:7},away:{name:'Away',score:0}}};
  const next=buildPublishedReportState(changed,game,null,baseline,at);
  assert.equal(next.changes.find(item=>item.kind==='direct_game_state_changed')?.sourceUrl,direct.sourceUrl);
});

test('published state retains dated wildfire and PM2.5 observations for the next hourly comparison',()=>{
  const sourceUrl='https://ofmpub.epa.gov/rsig/rsigserver?SERVICE=wcs&COVERAGE=airnow.pm25';
  const air=(asOf,observedAt,value)=>({state:'current_station_observation',asOf,sourceUrl,observation:{stationId:'123',distanceKm:12,pm25UgM3:value,observedAt,sourceUrl}});
  const base=bundle('checked');
  base.picture.airQualityContext=air('2026-10-10T01:00:00Z','2026-10-10T00:00:00Z',5);
  base.picture.wildfireContext={state:'current_snapshot',asOf:'2026-10-10T01:00:00Z',events:[]};
  const prior=buildPublishedReportState(base,game,null,null,at-3600000);
  assert.equal(prior.picture.airQualityContext.observation.pm25UgM3,5);
  const next=bundle('checked');
  next.picture.airQualityContext=air('2026-10-10T02:00:00Z','2026-10-10T01:00:00Z',11);
  next.picture.wildfireContext={state:'current_snapshot',asOf:'2026-10-10T02:00:00Z',events:[]};
  const result=buildPublishedReportState(next,game,null,prior,at);
  assert.equal(result.changes.find(item=>item.kind==='pm25_observation_changed')?.sourceUrl,sourceUrl);
  assert.equal(result.newChangeCount,1);
});

test('Seattle police title changes enter the feed only after comparable checks and a team or venue title match',()=>{
  const seattle={...game,id:'nfl:401872992',venue:{id:'3673'}};
  const item=(title,slug,publishedAt='2026-10-10T00:15:00Z')=>({title,publishedAt,url:`https://spdblotter.seattle.gov/2026/10/10/${slug}/`});
  const spd=(asOf,recent,state='current_citywide_headlines')=>({state,asOf,sourceUrl:'https://spdblotter.seattle.gov/feed/',recent});
  const make=context=>({picture:{eventId:seattle.id,sources:[{name:'Seattle Police dated public headlines',state:context.state,sourceUrl:context.sourceUrl}],cues:[],seattleSpdContext:context}});
  const first=buildPublishedReportState(make(spd('2026-10-10T01:00:00Z',[item('Ballard collision','ballard-collision')])),seattle,null,null,at-3600000);
  assert.equal(first.newChangeCount,0);
  const next=buildPublishedReportState(make(spd('2026-10-10T02:00:00Z',[item('Seahawks game traffic plan','seahawks-game-traffic','2026-10-10T01:15:00Z'),item('Ballard collision','ballard-collision')])),seattle,null,first,at);
  assert.equal(next.changes.find(change=>change.kind==='spd_event_title_added')?.sourceUrl,'https://spdblotter.seattle.gov/2026/10/10/seahawks-game-traffic/');
  const unrelated=buildPublishedReportState(make(spd('2026-10-10T03:00:00Z',[item('Another Ballard update','another-ballard'),item('Seahawks game traffic plan','seahawks-game-traffic','2026-10-10T01:15:00Z')])),seattle,null,next,at+3600000);
  assert.equal(unrelated.newChangeCount,0);
  const failed=buildPublishedReportState(make(spd('2026-10-10T04:00:00Z',[item('Lumen Field notice','lumen-field-notice')],'stale_or_unavailable')),seattle,null,unrelated,at+2*3600000);
  assert.equal(failed.changes.filter(change=>change.kind==='spd_event_title_added').length,1);
  assert.equal(failed.newChangeCount,1);
  assert.equal(failed.changes[0].kind,'source_status_changed');
});

test('repeated coverage flaps cannot evict a substantive city revision from bounded history',()=>{
  const substantive={kind:'city_regional_notice_revised',title:'Lakefront festival hours revised',detail:'Check city source',observedAt:'2026-10-10T02:00:00Z',sourceUrl:'https://ready.nola.gov/incident/'};
  const status=Array.from({length:40},(_,index)=>({kind:'source_status_changed',title:index%2?'NOPD calls: checked → stale':'NOPD calls: stale → checked',detail:'Check source',observedAt:new Date(Date.parse('2026-10-10T03:00:00Z')+index*60000).toISOString(),sourceUrl:'https://data.nola.gov/'})).reverse();
  const history=retainPublishedChanges(status,[substantive]);
  assert.equal(history.filter(item=>item.kind==='source_status_changed').length,2);
  assert.ok(history.includes(substantive));
  assert.equal(history.find(item=>item.title==='NOPD calls: checked → stale')?.observedAt,status.find(item=>item.title==='NOPD calls: checked → stale').observedAt);
});

test('newer road snapshots publish relationship reclassification without claiming resolution',()=>{
  const roadUrl='https://example.gov/road-records';
  const roadRow=asOf=>({name:'Road conditions',state:'time screened',asOf,sourceUrl:roadUrl});
  const record=relationship=>({relationship,ruleId:relationship==='excluded_link'?'ROAD_WINDOW_DISJOINT':'ROAD_RADIUS_WINDOW',recordId:'road-42',claim:'Road event at Example Street',sourceUrl:roadUrl});
  const make=(relationship,asOf)=>({picture:{eventId:game.id,sources:[roadRow(asOf)],cues:[],forecastContext:{state:'unavailable or stale'}},relationshipLedger:{schema:'event-atlas.nfl-relationship-ledger.v1',items:[record(relationship)]}});
  const first=buildPublishedReportState(make('excluded_link','2026-10-10T00:00:00Z'),game,null,null,at-3600000);
  const next=buildPublishedReportState(make('time_place_candidate','2026-10-10T01:00:00Z'),game,null,first,at);
  const change=next.changes.find(item=>item.kind==='road_event_relationship_reclassified');
  assert.equal(next.schema,'event-atlas.published-report-state.v9');
  assert.equal(change.sourceUrl,roadUrl);
  assert.match(change.detail,/excluded link to time place candidate/);
  assert.match(change.detail,/not evidence of a road reopening/);
  const repeated=buildPublishedReportState(make('time_place_candidate','2026-10-10T02:00:00Z'),game,null,next,at+3600000);
  assert.equal(repeated.newChangeCount,0);
  const excluded=buildPublishedReportState(make('excluded_link','2026-10-10T03:00:00Z'),game,null,repeated,at+2*3600000);
  assert.match(excluded.changes.find(item=>item.kind==='road_event_relationship_reclassified')?.detail||'',/time place candidate to excluded link/);
});

test('CAL FIRE county revisions enter the dated feed only after comparable successful checks',()=>{
  const la={...game,venue:{id:'7065'}};
  const item=(acres,containmentPercent)=>({name:'Bouquet Fire',counties:['Los Angeles'],started:'10/03/2026',acres,containmentPercent,sourceUrl:'https://www.fire.ca.gov/incidents/2026/10/3/bouquet-fire'});
  const calfire=(checkedAt,incidents,state='current_county_listing')=>state==='unavailable'?{state,county:'Los Angeles',sourceUrl:'https://www.fire.ca.gov/incidents/'}:{state,county:'Los Angeles',checkedAt,sourceUrl:'https://www.fire.ca.gov/incidents/',incidents};
  const make=context=>({...bundle('checked'),calfireRegional:context});
  const first=buildPublishedReportState(make(calfire('2026-10-10T01:00:00Z',[])),la,null,null,at-3600000);
  const listed=buildPublishedReportState(make(calfire('2026-10-10T02:00:00Z',[item(1048,83)])),la,null,first,at);
  assert.equal(listed.changes.find(change=>change.kind==='calfire_incident_listed')?.sourceUrl,item(1048,83).sourceUrl);
  const repeated=buildPublishedReportState(make(calfire('2026-10-10T02:00:00Z',[item(1048,83)])),la,null,listed,at+1000);
  assert.equal(repeated.newChangeCount,0);
  const revised=buildPublishedReportState(make(calfire('2026-10-10T03:00:00Z',[item(1050,84)])),la,null,repeated,at+3600000);
  assert.equal(revised.changes.find(change=>change.kind==='calfire_incident_revised')?.sourceUrl,item(1050,84).sourceUrl);
  const failed=buildPublishedReportState(make(calfire('2026-10-10T04:00:00Z',[],'unavailable')),la,null,revised,at+2*3600000);
  assert.equal(failed.changes[0].kind,'source_status_changed');
  const recovered=buildPublishedReportState(make(calfire('2026-10-10T05:00:00Z',[item(1060,85)])),la,null,failed,at+3*3600000);
  assert.equal(recovered.changes[0].kind,'source_status_changed');
  assert.equal(recovered.newChangeCount,1);
});

test('road relationship changes require a comparable schedule and newer successful source check',()=>{
  const roadUrl='https://example.gov/road-records';
  const make=(relationship,asOf,state='time screened')=>({picture:{eventId:game.id,sources:[{name:'Road conditions',state,asOf,sourceUrl:roadUrl}],cues:[],forecastContext:{state:'unavailable or stale'}},relationshipLedger:{schema:'event-atlas.nfl-relationship-ledger.v1',items:[{relationship,ruleId:relationship==='excluded_link'?'ROAD_WINDOW_DISJOINT':'ROAD_RADIUS_WINDOW',recordId:'road-42',claim:'Example road',sourceUrl:roadUrl}]}});
  const first=buildPublishedReportState(make('excluded_link','2026-10-10T00:00:00Z'),game,null,null,at-3600000);
  assert.equal(buildPublishedReportState(make('time_place_candidate','2026-10-10T00:00:00Z'),game,null,first,at).changes.filter(item=>item.kind==='road_event_relationship_reclassified').length,0);
  assert.equal(buildPublishedReportState(make('time_place_candidate','2026-10-10T01:00:00Z','source failed'),game,null,first,at).changes.filter(item=>item.kind==='road_event_relationship_reclassified').length,0);
  assert.equal(buildPublishedReportState(make('time_place_candidate','2026-10-10T01:00:00Z'),{...game,kickoff:'2026-10-11T21:00:00Z'},null,first,at).changes.filter(item=>item.kind==='road_event_relationship_reclassified').length,0);
  const legacy={...first,schema:'event-atlas.published-report-state.v7'};
  assert.equal(buildPublishedReportState(make('time_place_candidate','2026-10-10T01:00:00Z'),game,null,legacy,at).comparison,'previous published run');
  assert.equal(buildPublishedReportState(make('time_place_candidate','2026-10-10T01:00:00Z'),game,null,legacy,at).changes.filter(item=>item.kind==='road_event_relationship_reclassified').length,0);
});
