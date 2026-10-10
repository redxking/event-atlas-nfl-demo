import {selectDenverEventPlan,DENVER_EVENT_URL} from './denver_event_plan.js';

const fields=['eventStartsLocal','gatesOpenLocal','parkingOpenLocal','doorsLocal','ballArenaParking'];
export function snapshotDenverPlan(context,game,now){
  if(!context)return null;
  const value=selectDenverEventPlan(game,{...context,schema:'event-atlas.denver-event-plan.v1',status:context.state==='current_venue_plan'?'ok':'failed',gameId:game.id},now);
  if(value.state==='outside_source_event')return null;
  return value;
}

export function diffDenverPlan(prior,next,priorGame,game,observedAt){
  const now=Date.parse(observedAt);
  if(!Number.isFinite(now)||!prior||!next||priorGame?.id!==game?.id||priorGame.kickoff!==game.kickoff)return [];
  // Validate the earlier record at its own check time so source aging alone
  // does not erase the evidence needed to explain a coverage transition.
  const oldAt=Date.parse(prior.checkedAt);
  const before=snapshotDenverPlan(prior,priorGame,Number.isFinite(oldAt)?oldAt:now);
  const after=snapshotDenverPlan(next,game,now);
  if(!before||!after||Number.isFinite(oldAt)&&oldAt>now+60000)return [];
  if(before.state!==after.state)return [{kind:'source_status_changed',observedAt,title:`Denver venue access plan: ${before.state} → ${after.state}`,detail:'The venue-source check state changed. Verify the stadium page. Missing or recovered information does not establish that a gate opened, parking became available, or an issue was resolved.',sourceUrl:DENVER_EVENT_URL}];
  if(before.state!=='current_venue_plan'||Date.parse(after.checkedAt)<=oldAt)return [];
  const changed=fields.filter(key=>before[key]!==after[key]);
  if(!changed.length)return [];
  const timingWasConflicting=before.doorTimingConflict||before.kickoffConflict;
  const timingIsConflicting=after.doorTimingConflict||after.kickoffConflict;
  return [{kind:'denver_access_plan_revised',observedAt,title:'Denver exact-game venue access plan revised',detail:`Published fields changed: ${changed.map(key=>`${key}: ${before[key]} → ${after[key]}`).join('; ')}. Source checks ${before.checkedAt} to ${after.checkedAt}. ${timingWasConflicting&&!timingIsConflicting?'The current bounded fields no longer conflict; this is a publisher correction candidate requiring confirmation. ':''}Verify the current stadium plan. Publication changes do not establish actual gate or parking operation, event impact or a threat.`,sourceUrl:DENVER_EVENT_URL}];
}
