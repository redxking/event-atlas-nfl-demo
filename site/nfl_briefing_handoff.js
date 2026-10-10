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
