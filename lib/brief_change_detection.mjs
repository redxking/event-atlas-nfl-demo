const cueTypes=[['weather alert','NWS point alerts'],['road condition','Road conditions']];
const sourceRows=picture=>new Map((picture?.sources||[]).filter(row=>row&&typeof row.name==='string').map(row=>[row.name,row]));
const cueKey=cue=>cue.type==='transit alert'?JSON.stringify([cue.type,cue.sourceUrl||null]):JSON.stringify([cue.type,cue.sourceUrl||null,cue.title,cue.sourceAt||null]);
const publicCue=cue=>({type:cue.type,title:cue.title,basis:cue.basis,sourceUrl:cue.sourceUrl||null,sourceAt:cue.sourceAt||null});
const cueMap=(picture,type)=>new Map((picture?.cues||[]).filter(cue=>cue?.type===type).map(cue=>[cueKey(cue),publicCue(cue)]));

function policeChange(before,after,oldSources,newSources){
  const prior=before?.policeContext,current=after?.policeContext;
  const sourceBefore=oldSources.get('Local police activity'),sourceAfter=newSources.get('Local police activity');
  if(!prior||!current||!sourceBefore?.sourceUrl||sourceBefore.sourceUrl!==sourceAfter?.sourceUrl)return {state:'not_comparable',reason:'A police aggregate or its source identity is unavailable in one brief.'};
  if(!Number.isSafeInteger(prior.nearby)||!Number.isSafeInteger(current.nearby))return {state:'not_comparable',reason:'A bounded area count is unavailable in one brief.'};
  if(prior.start!==current.start||prior.end!==current.end||prior.radiusKm!==current.radiusKm)return {state:'different_windows',reason:'Rolling or otherwise different area windows must not be compared as a trend.'};
  return {state:prior.nearby===current.nearby?'same_window_unchanged':'same_window_count_changed',previousCount:prior.nearby,currentCount:current.nearby,window:{start:current.start,end:current.end,radiusKm:current.radiusKm},interpretation:'Same-window count difference may reflect source corrections or backfill; it is not a threat or trend assessment.'};
}

export function comparePublicEvidence(previous,current){
  const before=previous?.nflContext?.evidence?.picture,after=current?.nflContext?.evidence?.picture;
  if(!before||!after)return {state:'not_comparable',reason:'An NFL public-source event picture is unavailable in one brief.',sourceTransitions:[],reviewCues:{added:[],changed:[],noLongerPresent:[],notCompared:cueTypes.map(([type])=>type)},policeAggregate:{state:'not_comparable'}};
  const oldSources=sourceRows(before),newSources=sourceRows(after);
  const compareTypes=previous.nflContext.evidence.venue?.id==='3738'||current.nflContext.evidence.venue?.id==='3738'?[...cueTypes,['transit alert','MBTA Foxboro station alerts']]:cueTypes;
  const sourceTransitions=[...new Set([...oldSources.keys(),...newSources.keys()])].sort().flatMap(name=>{
    const prior=oldSources.get(name),next=newSources.get(name),from=prior?.state||'missing',to=next?.state||'missing';
    return from===to?[]:[{name,from,to,sourceUrl:next?.sourceUrl||prior?.sourceUrl||null}];
  });
  const oldEvent=previous.nflContext.evidence.event,newEvent=current.nflContext.evidence.event;
  const sameWindow=oldEvent?.kickoff===newEvent?.kickoff&&oldEvent?.timeTbd===newEvent?.timeTbd&&oldEvent?.status===newEvent?.status;
  const currentSnapshots=previous.nflContext.status==='snapshot_available_unreviewed'&&current.nflContext.status==='snapshot_available_unreviewed';
  const reviewCues={added:[],changed:[],noLongerPresent:[],notCompared:[]};
  for(const [type,sourceName] of compareTypes){
    const prior=oldSources.get(sourceName),next=newSources.get(sourceName);
    const comparable=currentSnapshots&&sameWindow&&(type==='weather alert'?prior?.state==='checked'&&next?.state==='checked':type==='transit alert'?prior?.state==='station alerts checked'&&next?.state==='station alerts checked'&&prior?.sourceUrl===next?.sourceUrl&&before.transitContext?.screenable===true&&after.transitContext?.screenable===true&&before.transitContext?.eventWindow?.start===after.transitContext?.eventWindow?.start&&before.transitContext?.eventWindow?.end===after.transitContext?.eventWindow?.end:prior?.state==='time screened'&&next?.state==='time screened');
    if(!comparable){reviewCues.notCompared.push(type);continue}
    const oldCues=cueMap(before,type),newCues=cueMap(after,type);
    for(const [key,cue] of newCues){
      if(!oldCues.has(key))reviewCues.added.push(cue);
      else if(oldCues.get(key).basis!==cue.basis||oldCues.get(key).title!==cue.title||oldCues.get(key).sourceAt!==cue.sourceAt)reviewCues.changed.push({previous:oldCues.get(key),current:cue});
    }
    for(const [key,cue] of oldCues)if(!newCues.has(key))reviewCues.noLongerPresent.push(cue);
  }
  return {state:currentSnapshots&&sameWindow?'compared':'partial',reason:!sameWindow?'The listed event time or status changed; review cues cannot be compared across event windows.':!currentSnapshots?'One NFL context is stale or unavailable; review cues require current matched snapshots.':null,sourceTransitions,reviewCues,policeAggregate:policeChange(before,after,oldSources,newSources),interpretation:'Changes are source observations for analyst review. A missing cue can reflect an updated or incomplete feed and is not evidence that a hazard or threat resolved.'};
}
