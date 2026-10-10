import {CHARGERS_THEMES_URL} from './chargers_themes.js';
import {METRO_SOFI_URL} from './metro_sofi_plan.js';
import {METRO_I105_DETAIL_URL} from './metro_i105_notice.js';

const specs={
  chargersTheme:{name:'Chargers game theme',url:CHARGERS_THEMES_URL,states:['published_game_theme'],fields:['week','opponent','theme','presentingPartner']},
  metroSofiPlan:{name:'Metro SoFi service plan',url:METRO_SOFI_URL,states:['published_operator_plan'],fields:['boarding','outboundStartsHoursBeforeKickoff','outboundMaximumMinutesBetweenBuses','returnStarts','returnMaximumMinutesBetweenBuses','returnMinutesAfterGame']},
  metroI105Notice:{name:'Metro I-105 work notice',url:METRO_I105_DETAIL_URL,states:['pregame_window_overlap','outside_review_window'],fields:['route','closureStart','closureEnd','cLineBridgeStart','cLineBridgeEnd','lanes','operationState']}
};
const unavailable=new Set(['unavailable','kickoff_unverified','no_exact_match']);
function normalized(item,spec){
  if(item?.sourceUrl!==spec.url)return null;
  if(unavailable.has(item.state))return {state:item.state,sourceUrl:spec.url};
  if(!spec.states.includes(item.state)||!Number.isFinite(Date.parse(item.checkedAt)))return null;
  const fields={};
  for(const key of spec.fields){
    const value=item[key];
    if(value!==null&&typeof value!=='string'&&typeof value!=='number')return null;
    if(typeof value==='string'&&value.length>300||typeof value==='number'&&!Number.isFinite(value))return null;
    fields[key]=value;
  }
  return {state:'published_plan',sourceUrl:spec.url,checkedAt:item.checkedAt,fields};
}

export function snapshotSofiPlans(bundle){
  return Object.fromEntries(Object.entries(specs).map(([key,spec])=>[key,normalized(bundle[key],spec)]));
}

export function diffSofiPlans(prior,next,observedAt){
  const observed=Date.parse(observedAt);
  if(!Number.isFinite(observed))return [];
  const changes=[];
  for(const [key,spec] of Object.entries(specs)){
    // Normalize retained state again: persisted snapshots are not trusted inputs.
    const restore=item=>normalized(item?.state==='published_plan'?{...item,...item.fields,state:spec.states[0]}:item,spec);
    const before=restore(prior?.[key]),after=restore(next?.[key]);
    if(!before||!after)continue;
    if([before,after].some(item=>item.checkedAt&&Date.parse(item.checkedAt)>observed+60000))continue;
    if(before.state!==after.state){
      changes.push({kind:'source_status_changed',observedAt,title:`${spec.name}: ${before.state} → ${after.state}`,detail:'The source check state changed. Verify the publisher plan; a failed check or recovery does not establish cancellation, restoration of service, or event impact.',sourceUrl:spec.url});
      continue;
    }
    if(after.state!=='published_plan'||Date.parse(after.checkedAt)<=Date.parse(before.checkedAt))continue;
    const fields=spec.fields.filter(field=>before.fields[field]!==after.fields[field]);
    if(fields.length)changes.push({kind:'sofi_plan_revised',observedAt,title:`${spec.name} revised`,detail:`Changed published fields: ${fields.map(field=>`${field}: ${before.fields[field]??'not supplied'} → ${after.fields[field]??'not supplied'}`).join('; ')}. Observed between source checks ${before.checkedAt} and ${after.checkedAt}. Confirm with the operator; this does not establish actual operation, attendance, venue impact or a threat.`.slice(0,1500),sourceUrl:spec.url});
  }
  return changes;
}
