import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const fields=['title','startsAtLocal','endsAtLocal','timeZone','placeId','venueId','status','organizer','sourceUrl','timeTbd','participants'];
export const projectEvent=event=>({...Object.fromEntries(fields.map(field=>[field,event?.[field]??null])),sourcePlace:{name:event?.sourcePlace?.name??null,address:event?.sourcePlace?.address??null,lat:event?.sourcePlace?.lat??null,lon:event?.sourcePlace?.lon??null}});
const project=projectEvent;
const same=(a,b)=>JSON.stringify(project(a))===JSON.stringify(project(b));
const datePart=event=>String(event.startsAtLocal||'').slice(0,10);

export function caseEventDrift(intake,current,connector){
  const connectorStatus=connector?.status||'unknown',latestRetrievedAt=current?.retrievedAt||null;
  if(!intake?.operationalSnapshot)return {status:'baseline_unavailable',changedFields:[],latestRetrievedAt,connectorStatus};
  if(connectorStatus!=='ok')return {status:'source_stale',changedFields:[],latestRetrievedAt,connectorStatus};
  if(!current)return {status:'missing_from_current_snapshot',changedFields:[],latestRetrievedAt,connectorStatus};
  const latest=projectEvent(current);
  const changedFields=[...fields,'sourcePlace'].filter(field=>JSON.stringify(intake.operationalSnapshot[field]??null)!==JSON.stringify(latest[field]??null));
  return {status:changedFields.length?'changed_since_intake':'unchanged_since_intake',changedFields,latestRetrievedAt,connectorStatus};
}

export function reconcileEventSnapshot(previous,candidate){
  const old=previous||{events:[],places:[],sources:[]};
  const oldById=new Map(old.events.map(e=>[e.id,e]));
  const oldSources=new Map(old.sources.map(s=>[s.id,s]));
  const sources=[];const events=[];const changes=[];const retainedSources=[];
  const fromDate=candidate.fromDate||candidate.retrievedAt.slice(0,10);
  for(const source of candidate.sources){
    const previousEvents=old.events.filter(e=>e.sourceId===source.id);
    const freshEvents=candidate.events.filter(e=>e.sourceId===source.id);
    const futureOld=previousEvents.filter(e=>datePart(e)>=fromDate);
    const zeroAnomaly=source.status==='ok'&&freshEvents.length===0&&futureOld.length>0;
    const usable=source.status==='ok'&&!zeroAnomaly;
    if(!usable){
      retainedSources.push(source.id);
      events.push(...previousEvents);
      sources.push({...source,status:'stale_retained',records:previousEvents.length,lastSuccessfulAt:oldSources.get(source.id)?.retrievedAt||null,error:zeroAnomaly?'Zero-record response quarantined while prior future events exist':source.error||'Source failed'});
      continue;
    }
    events.push(...freshEvents);
    sources.push(source);
    for(const current of freshEvents){const prior=oldById.get(current.id);if(!prior)changes.push({kind:'added',eventId:current.id,sourceId:source.id,before:null,after:project(current)});else if(!same(prior,current))changes.push({kind:'changed',eventId:current.id,sourceId:source.id,before:project(prior),after:project(current),changedFields:[...fields,'sourcePlace'].filter(f=>JSON.stringify(project(prior)[f])!==JSON.stringify(project(current)[f]))})}
    const freshIds=new Set(freshEvents.map(e=>e.id));
    for(const prior of futureOld)if(!freshIds.has(prior.id))changes.push({kind:'missing_from_current_feed',eventId:prior.id,sourceId:source.id,before:project(prior),after:null});
  }
  const placeById=new Map([...old.places,...candidate.places].map(p=>[p.id,p]));
  const referenced=new Set(events.map(e=>e.placeId).filter(Boolean));
  const places=[...referenced].map(id=>placeById.get(id)).filter(Boolean);
  const digest=crypto.createHash('sha256').update(JSON.stringify(events.map(e=>[e.id,project(e)]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
  return {...candidate,sources,events,places,changeSet:{runId:crypto.randomUUID(),comparedTo:previous?.retrievedAt||null,generatedAt:candidate.retrievedAt,digest,retainedSources,items:previous?changes:[]}};
}

export async function saveReconciledEventSnapshot(file,candidate){
  const previous=JSON.parse(await fs.readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return 'null';throw error}));
  const result=reconcileEventSnapshot(previous,candidate);
  const temporary=file+'.tmp';
  await fs.writeFile(temporary,JSON.stringify(result));
  await fs.rename(temporary,file);
  return result;
}
