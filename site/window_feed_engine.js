import {buildExerciseBrief,exerciseDomains} from './demo_exercise.js';
import {supplementalFeeds,supplementalCandidates,validateSupplementalPayload} from './window_supplemental_feeds.js';
export const MODE='synthetic_exercise';
export const feedCatalog=exerciseDomains.flatMap((domain,domainIndex)=>domain.sources.map((name,index)=>({id:`feed-${domainIndex+1}-${index+1}`,domain:domain.name,name,dataMode:MODE}))).concat(supplementalFeeds.map(({id,domain,name})=>({id,domain,name,dataMode:MODE})));

export function createGameFeed(game){
  if(!/^nfl:\d+$/.test(game?.id||'')||!Number.isFinite(Date.parse(game.kickoff)))throw Error('Valid scoped game required');
  const template=buildExerciseBrief(3),start=Date.parse(game.kickoff)-2*3600000;
  const deliveries=[];
  const push=(sourceIndex,operation,recordId,claim,extra={})=>{
    const sequence=deliveries.length+1;
    deliveries.push({schema:'event-atlas.demo-feed-record.v1',dataMode:MODE,eventId:game.id,deliveryId:`${game.id}:delivery:${sequence}`,sequence,sourceId:feedCatalog[sourceIndex].id,operation,recordId,claim,observedAt:new Date(start+sequence*30000).toISOString(),...extra});
  };
  template.observations.forEach((item,index)=>push(index,'observe',item.id,item.summary));
  push(15,'duplicate','S-16',template.observations[15].summary,{duplicateOf:'S-16'});
  push(15,'observe','X-01','Fictional service owner reports a scheduled load test; this contradicts the inference that the traffic spike establishes an attack.');
  push(9,'outage',null,'Fictional CAD adapter disconnected; incident coverage unavailable.');
  push(12,'correct','S-13','Fictional venue team identifies the bag as an authorized delivery; initial suspicious-item description is corrected.',{supersedes:'S-13'});
  push(9,'recovery',null,'Fictional CAD adapter restored; outage coverage remains unknown.');
  push(15,'correct','S-16','Fictional service owner confirms the scheduled load test ended; measured service availability remained within its exercise baseline.',{supersedes:'S-16'});
  supplementalFeeds.forEach((source,index)=>push(19+index,'observe',`S-${20+index}`,source.claim,{payload:structuredClone(source.payload)}));
  push(19,'outage',null,'Synthetic camera connection lost. No current frame is available.');
  push(19,'recovery',null,'Synthetic camera connection restored; the missing interval remains unknown.');
  push(19,'correct','S-20','Synthetic camera delivers a new training frame after recovery. The outage interval remains unknown.',{supersedes:'S-20',payload:{...supplementalFeeds[0].payload,frame:2}});
  return {schema:'event-atlas.game-feed-replay.v1',dataMode:MODE,event:{id:game.id,title:game.title,kickoff:game.kickoff,venue:game.venue},startAt:new Date(start).toISOString(),sources:feedCatalog,deliveries};
}

export function replayGameFeed(feed,count=feed?.deliveries?.length,clock=null){
  if(feed?.schema!=='event-atlas.game-feed-replay.v1'||feed.dataMode!==MODE||!Array.isArray(feed.deliveries)||!Number.isSafeInteger(count)||count<0||count>feed.deliveries.length)throw Error('Invalid synthetic replay');
  const sourceIds=new Set(feedCatalog.map(item=>item.id)),records=new Map(),history=[],seen=new Set(),sources=new Map(feedCatalog.map(item=>[item.id,{...item,state:'waiting',lastReceivedAt:null}]));
  let duplicates=0;
  for(const item of feed.deliveries.slice(0,count)){
    if(typeof item.deliveryId!=='string'||!item.deliveryId.startsWith(`${feed.event.id}:delivery:`)||!Number.isSafeInteger(item.sequence)||item.sequence<1)throw Error('Invalid delivery identity');
    if(item.schema!=='event-atlas.demo-feed-record.v1'||item.dataMode!==MODE||item.eventId!==feed.event.id||!sourceIds.has(item.sourceId)||!['observe','correct','duplicate','outage','recovery'].includes(item.operation)||!Number.isFinite(Date.parse(item.observedAt))||typeof item.claim!=='string'||item.claim.length>600)throw Error('Invalid or cross-event feed record');
    if(seen.has(item.deliveryId)){duplicates++;continue}seen.add(item.deliveryId);
    const source=sources.get(item.sourceId);source.lastReceivedAt=item.observedAt;
    if(item.operation==='outage'){source.state='unavailable';history.push(item);continue}
    source.state='simulated_connected';
    if(item.operation==='recovery'){history.push(item);continue}
    if(item.operation==='duplicate'){if(!records.has(item.duplicateOf))throw Error('Unknown duplicate origin');duplicates++;history.push(item);continue}
    validateSupplementalPayload(item.sourceId,item.payload);
    if(!/^([SX]-\d{2})$/.test(item.recordId||''))throw Error('Invalid exercise record ID');
    if(item.operation==='correct'&&(!records.has(item.supersedes)||item.supersedes!==item.recordId))throw Error('Missing correction origin');
    if(item.operation==='observe'&&records.has(item.recordId))throw Error('Conflicting observation ID');
    records.set(item.recordId,{...item,evidenceId:`${feed.event.id}:exercise:${item.recordId}`,revision:(records.get(item.recordId)?.revision||0)+1});history.push(item);
  }
  const at=clock||history.at(-1)?.observedAt||feed.startAt;
  if(!Number.isFinite(Date.parse(at))||history.some(item=>Date.parse(item.observedAt)>Date.parse(at)))throw Error('Invalid exercise clock');
  for(const source of sources.values())if(source.state==='simulated_connected'&&Date.parse(at)-Date.parse(source.lastReceivedAt)>30*60000)source.state='stale';
  const template=buildExerciseBrief(3);
  const candidates=[...template.correlations,...supplementalCandidates].filter(item=>item.evidence.every(id=>records.has(id))).map(item=>({...item,id:`${feed.event.id}:${item.id}`,dataMode:MODE,evidenceIds:item.evidence.map(id=>records.get(id).evidenceId),contraryEvidenceIds:item.id==='C-03'&&records.has('X-01')?[records.get('X-01').evidenceId]:[],state:item.evidence.some(id=>records.get(id).revision>1)?'updated_evidence_requires_review':'unreviewed_candidate'}));
  return {schema:'event-atlas.game-exercise-brief.v1',dataMode:MODE,event:feed.event,clock:at,version:history.length,observations:[...records.values()],history,sources:[...sources.values()],duplicatesExcluded:duplicates,candidates,assessment:{severity:'not_assessed',model:'deterministic replay; no model invoked'},limitations:['All observations are fictional; the real game is a demonstration backdrop.','Source outage, correction and record proximity do not establish a threat or an all-clear.']};
}
