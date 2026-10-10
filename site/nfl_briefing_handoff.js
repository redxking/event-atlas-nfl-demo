import {selectSofiEventPage} from './sofi_event_pages.js';
import {selectDenverEventPlan} from './denver_event_plan.js';
const https=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}};
const validTime=value=>Number.isFinite(Date.parse(value));

export function buildNflBriefingHandoff(bundle){
  const planning=bundle?.reportMonitoringMode==='season_planning';
  const now=Date.parse(bundle?.generatedAt);
  const ledger=bundle?.relationshipLedger;
  const queue=bundle?.picture?.reviewQueue;
  const changes=bundle?.publishedChanges;
  const selected=[];
  const add=(kind,title,action,sourceUrl,sourceAt)=>{
    const url=https(sourceUrl);
    if(!url||selected.some(item=>item.sourceUrl===url&&item.title===title))return;
    selected.push({kind,title:String(title||'').slice(0,240),action:String(action||'').slice(0,500),sourceUrl:url,sourceAt:validTime(sourceAt)?new Date(sourceAt).toISOString():null});
  };
  if(!planning){
    const denver=selectDenverEventPlan({...bundle.event,venue:bundle.venue},{...bundle.denverEventPlan,schema:'event-atlas.denver-event-plan.v1',status:bundle.denverEventPlan?.state==='current_venue_plan'?'ok':'failed',gameId:bundle.event?.id},now);
    if(denver.state==='current_venue_plan'&&(denver.doorTimingConflict||denver.kickoffConflict))add('venue timing conflict',`Denver venue lists gates ${denver.gatesOpenLocal}, doors ${denver.doorsLocal} and event start ${denver.eventStartsLocal}`,'Confirm the exact-game gate and kickoff times with the stadium. Rescreen time-dependent access plans after confirmation.',denver.sourceUrl,denver.checkedAt);
    const venue=bundle.sofiVenueEvent;
    const event=bundle.event;
    const sofiGames={
      'nfl:401872989':{home:'Los Angeles Chargers',away:'Denver Broncos',date:'Oct. 11, 2026'},
      'nfl:401872994':{home:'Los Angeles Rams',away:'Buffalo Bills',date:'Oct. 12, 2026'}
    };
    const spec=sofiGames[event?.id];
    if(spec&&Number.isFinite(now)&&venue?.state==='current_venue_event_page'){
      // Revalidate exact-game identity, freshness and contradictory source fields.
      const checked=selectSofiEventPage({...event,venue:bundle.venue,teams:[{role:'home',name:spec.home},{role:'away',name:spec.away}]},{schema:'event-atlas.sofi-event-pages.v1',status:'ok',venueId:bundle.venue?.id,checkedAt:venue.asOf,pages:{[event.id]:{...venue,gameId:event.id,eventDateText:spec.date}}},now);
      if(checked.state==='current_venue_event_page'&&checked.detailKickoffConflictsWithSidebar)add('venue timing conflict',`SoFi lists ${checked.eventStartsLocal} in the event sidebar and ${checked.detailKickoffLocal} in the kickoff detail`,'Confirm the official kickoff with the stadium and club before using either time for transport, staffing or airspace review. Recheck every time-dependent comparison after confirmation.',checked.sourceUrl,checked.asOf);
    }
    for(const item of ledger?.items||[]){
      if(item.relationship==='contradictory_record')add('schedule conflict',item.claim,'Confirm the exact kickoff and rescreen every time-dependent source link.',item.sourceUrl,item.sourceTime);
    }
    for(const item of changes?.newItems||[]){
      if(item.kind==='source_status_changed'||!validTime(item.observedAt)||!Number.isFinite(now)||Math.abs(now-Date.parse(item.observedAt))>5*60000)continue;
      add('new source change',item.title,`${item.detail} Verify the publisher record and event relationship.`,item.sourceUrl,item.observedAt);
    }
    for(const item of queue?.items||[]){
      if(item.status!=='source_check_needed')continue;
      add('coverage recovery',item.trigger,item.action,item.sourceUrl,item.sourceAt);
    }
    for(const item of queue?.items||[]){
      if(item.status!=='unreviewed_source_cue')continue;
      add('event-window review',item.trigger,item.action,item.sourceUrl,item.sourceAt);
    }
  }
  const items=selected.slice(0,5);
  return {
    state:planning?'planning_only':items.length?'verification_actions':'no_selected_actions',
    items,
    gapCount:Array.isArray(bundle?.picture?.gaps)?bundle.picture.gaps.length:0,
    changeComparison:changes?.comparison||'no comparable change state',
    newChangeCount:Number.isInteger(changes?.newChangeCount)?changes.newChangeCount:null,
    note:planning?'The event is outside the seven-day monitoring window. These sources are planning context, not current event conditions.':items.length?'Ordered source checks for analyst review. Selection reflects evidence linkage and recent change, not severity, likelihood, or a threat determination.':'No linked action passed this bounded selection. Inspect source status and coverage gaps; this is not an all-clear.'
  };
}
