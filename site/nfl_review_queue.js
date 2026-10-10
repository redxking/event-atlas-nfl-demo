import {sourcePoint} from './concern_location.js';
const actions={
  'weather alert':{domain:'weather alert',check:'Confirm the current NWS alert, its footprint, validity window, and venue relevance with the issuing office or official alert record.'},
  'road condition':{domain:'road access',check:'Confirm the road record is still active and whether it affects an actual event route with the road agency and venue transport lead.'},
  'regional road advisory':{domain:'regional road access',check:'Check the current AZ511 and ADOT closure details, exact time, and whether the corridor lies on a real event route. A regional notice alone does not verify an impact.'},
  'access plan overlap':{domain:'pregame access',check:'Confirm the club’s current Champions Square period, the DOTD road record and whether the affected segment lies on a real event route. Do not infer a disruption from distance and time overlap.'},
  'transit alert':{domain:'transit access',check:'Confirm current service and the affected station, line, and event travel window with the transit operator.'},
  'convective outlook':{domain:'weather forecast',check:'Review the latest SPC outlook and local NWS forecast before making an event weather decision.'},
  'excessive rainfall outlook':{domain:'weather forecast',check:'Review the latest WPC outlook and local NWS flood products before making an event access decision.'}
};
const recoveryActions={
  'NFL schedule':'Confirm the exact game time and venue on the publisher record before using event-window comparisons.',
  'NWS point alerts':'Check the official NWS point alert endpoint directly and restore the automated check before drawing any conclusion from an empty alert list.',
  'NWS kickoff forecast':'Check the current NWS hourly forecast for the listed kickoff; do not substitute an old forecast.',
  'NWS event-hour forecast':'Check the current NWS hourly forecast for the active event hour; do not substitute an old forecast.',
  'ESPN selected-game direct check':'Confirm the exact game identity and current publisher status before relying on the dated schedule snapshot.'
};

const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}};
const validTime=value=>Number.isFinite(Date.parse(value));

export function buildNflReviewQueue(game,picture,monitoringMode,now=Date.now()){
  if(monitoringMode!=='near_term_monitoring')return {state:'not_started',items:[],note:'Event-window verification starts in the near-term monitoring window; season planning sources do not establish conditions at kickoff.'};
  const phase=game?.status==='in progress in source'?'active event':validTime(game?.kickoff)&&Date.parse(game.kickoff)>now?'before listed kickoff':'after listed kickoff';
  const recovery=(Array.isArray(picture?.sources)?picture.sources:[]).filter(item=>recoveryActions[item?.name]&&/source failed|stale|unavailable|not current|not yet checked|source_failed/.test(item.state||'')).slice(0,5).map(item=>{
    const sourceUrl=safeUrl(item.sourceUrl);
    return sourceUrl?{domain:'source coverage',trigger:`${item.name}: ${item.state}`,basis:String(item.detail||'').slice(0,400),sourceAt:validTime(item.asOf)?new Date(item.asOf).toISOString():null,sourceUrl,phase,action:recoveryActions[item.name],status:'source_check_needed'}:null;
  }).filter(Boolean);
  const cues=(Array.isArray(picture?.cues)?picture.cues:[]).slice(0,20).map(cue=>{
    const action=actions[cue?.type];
    const sourceUrl=safeUrl(cue?.sourceUrl);
    if(!action||!sourceUrl)return null;
    return {sourceId:cue.sourceId==null?null:String(cue.sourceId).slice(0,300),location:sourcePoint(cue.location),domain:action.domain,trigger:String(cue.title||cue.type).slice(0,180),basis:String(cue.basis||'').slice(0,400),sourceAt:validTime(cue.sourceAt)?new Date(cue.sourceAt).toISOString():null,sourceUrl,relatedSourceUrl:safeUrl(cue.relatedSourceUrl),phase,action:action.check,status:'unreviewed_source_cue'};
  }).filter(Boolean).slice(0,12);
  const items=[...recovery,...cues];
  return {state:items.length?'review_candidates':'no_time_screened_cues',items,note:items.length?'Source-linked verification tasks. Source failures are coverage gaps; other rows are unreviewed publisher observations and forecasts. None is a threat, confirmed venue impact, or completed analyst action.':'No time-screened cue appears in the bounded current sample. This is not an all-clear; inspect source status and missing operational inputs.'};
}
