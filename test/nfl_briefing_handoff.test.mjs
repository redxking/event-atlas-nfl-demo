import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflBriefingHandoff} from '../site/nfl_briefing_handoff.js';

const at='2026-10-10T16:30:00Z';
const report={generatedAt:at,reportMonitoringMode:'near_term_monitoring',picture:{gaps:['No stadium CCTV'],reviewQueue:{items:[
  {status:'unreviewed_source_cue',trigger:'Nearby road closure',action:'Confirm route effect.',sourceUrl:'https://dot.example.gov/road',sourceAt:'2026-10-10T16:00:00Z'},
  {status:'source_check_needed',trigger:'NWS point check failed',action:'Restore point check.',sourceUrl:'https://api.weather.gov/alerts/active?point=1,2'}
]}},relationshipLedger:{items:[{relationship:'contradictory_record',claim:'Kickoff differs',sourceUrl:'https://espn.example.org/game',sourceTime:at}]},publishedChanges:{comparison:'previous published run',newChangeCount:2,newItems:[
  {kind:'new_wildfire_point',title:'New regional fire point',detail:'Source point within 50 km.',sourceUrl:'https://fire.example.gov/1',observedAt:at},
  {kind:'source_status_changed',title:'Feed failed',detail:'Coverage only',sourceUrl:'https://feed.example.gov',observedAt:at}
]}};

test('handoff orders schedule conflict, new content, coverage recovery, then event-window cue',()=>{
  const digest=buildNflBriefingHandoff(report);
  assert.deepEqual(digest.items.map(item=>item.kind),['schedule conflict','new source change','coverage recovery','event-window review']);
  assert.equal(digest.gapCount,1);
  assert.equal(digest.newChangeCount,2);
  assert.match(digest.note,/not severity/);
  assert.ok(!digest.items.some(item=>item.title==='Feed failed'));
});

test('planning and invalid links do not produce live source actions',()=>{
  assert.deepEqual(buildNflBriefingHandoff({...report,reportMonitoringMode:'season_planning'}).items,[]);
  const invalid=structuredClone(report);
  invalid.relationshipLedger.items[0].sourceUrl='javascript:alert(1)';
  invalid.publishedChanges.newItems[0].sourceUrl='http://fire.example.gov/1';
  invalid.picture.reviewQueue.items[0].sourceUrl='data:text/html,unsafe';
  const digest=buildNflBriefingHandoff(invalid);
  assert.deepEqual(digest.items.map(item=>item.kind),['coverage recovery']);
});

test('old retained changes are not presented as new source changes',()=>{
  const old=structuredClone(report);
  old.publishedChanges.newItems[0].observedAt='2026-10-09T16:30:00Z';
  assert.ok(!buildNflBriefingHandoff(old).items.some(item=>item.kind==='new source change'));
});

const sofiReport=()=>({...structuredClone(report),event:{id:'nfl:401872989',kickoff:'2026-10-11T20:05:00Z'},venue:{id:'7065'},sofiVenueEvent:{state:'current_venue_event_page',asOf:at,sourceUrl:'https://www.sofistadium.com/events/detail/chargers-broncos-2026',eventStartsLocal:'1:05 PM',detailKickoffLocal:'1:35 PM',parkingLotsOpenLocal:'9:00 AM',doorsOpenLocal:'11:00 AM',detailKickoffConflictsWithSidebar:true,sourceTextSha256:'a'.repeat(64)}});

test('fresh exact-game venue timing conflict leads the handoff',()=>{
  const result=buildNflBriefingHandoff(sofiReport());
  assert.equal(result.items[0].kind,'venue timing conflict');
  assert.match(result.items[0].title,/1:05 PM.*1:35 PM/);
  assert.match(result.items[0].action,/Confirm the official kickoff/);
  assert.equal(result.items[0].sourceAt,new Date(at).toISOString());
});

test('venue conflict excludes stale, inconsistent, wrong-game and planning records',()=>{
  const variants=[
    value=>value.sofiVenueEvent.asOf='2026-10-09T01:00:00Z',
    value=>value.sofiVenueEvent.detailKickoffLocal='1:05 PM',
    value=>value.sofiVenueEvent.sourceUrl='https://www.sofistadium.com/events/detail/rams-bills-2026',
    value=>value.venue.id='other',
    value=>value.event.kickoff='2026-10-12T20:05:00Z',
    value=>value.event.timeTbd=true,
    value=>value.reportMonitoringMode='season_planning'
  ];
  for(const mutate of variants){const value=sofiReport();mutate(value);assert.ok(!buildNflBriefingHandoff(value).items.some(item=>item.kind==='venue timing conflict'))}
});
