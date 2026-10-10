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
