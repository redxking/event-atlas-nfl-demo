import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWeGoTitansService} from '../site/wego_titans_alert.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {diffEventPicture} from '../site/event_picture_changes.js';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/wego_titans_alert.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872984');
const now=Date.parse(snapshot.servicePlan.checkedAt)+1000;

test('WeGo general service plan is scoped to the Titans game and preserves boarding conflict',()=>{
  const plan=selectWeGoTitansService(game,snapshot,now);
  assert.equal(plan.state,'current_operator_plan');
  assert.deepEqual(plan.localRouteNumbers,['4','14','23','41','56']);
  const bundle=buildNflEvidenceBundle(game,{schedule,wegoTitansAlert:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/WeGo Titans game-day bus and train plan/);
  assert.match(report,/verify the correct boarding point with WeGo/);
  assert.equal(selectWeGoTitansService(game,{...snapshot,servicePlan:{...snapshot.servicePlan,sourceUrl:'https://example.com/'}},now).state,'stale_or_unavailable');
  assert.equal(selectWeGoTitansService(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
});

test('WeGo service-plan revision needs two current, newer operator checks',()=>{
  const plan=selectWeGoTitansService(game,snapshot,now);
  const before={eventId:game.id,sources:[],cues:[],wegoTitansServiceContext:plan};
  const after={...before,wegoTitansServiceContext:{...plan,asOf:new Date(now+3600000).toISOString(),sourceTextSha256:'a'.repeat(64)}};
  assert.equal(diffEventPicture(before,after,null,null,game,game).find(item=>item.kind==='operator_game_service_plan_revised')?.sourceUrl,plan.sourceUrl);
  assert.equal(diffEventPicture({...before,wegoTitansServiceContext:{...plan,state:'stale_or_unavailable'}},after,null,null,game,game).some(item=>item.kind==='operator_game_service_plan_revised'),false);
});
