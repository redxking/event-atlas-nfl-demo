import crypto from 'node:crypto';

export const votingFields=['name','type','jurisdiction','county','city','street','addressLine2','postal','lat','lon','precinct','precinctCode','precinctSplitCode','ward','status','datesOpen','hours','schedule','votingSpace','accessibility','sourceUrl','sourceDataStatus'];
export function projectVotingSite(site){return Object.fromEntries(votingFields.map(field=>[field,site?.[field]??null]))}
export function changedVotingFields(before,after){const old=projectVotingSite(before),now=projectVotingSite(after);return votingFields.filter(field=>JSON.stringify(old[field])!==JSON.stringify(now[field]))}

export function reconcileVotingSnapshot(previous,candidate){
  const old=previous||{locations:[],sources:[]};
  const oldById=new Map(old.locations.map(site=>[site.id,site]));
  const newById=new Map(candidate.locations.map(site=>[site.id,site]));
  if(newById.size!==candidate.locations.length)throw Error('Duplicate voting location IDs in candidate snapshot');
  const sourceById=new Map(candidate.sources.map(source=>[source.id,source]));
  const changes=[];
  for(const site of candidate.locations){
    const prior=oldById.get(site.id),source=sourceById.get(site.sourceId);
    if(!source)throw Error(`Voting site ${site.id} has no source`);
    if(source.status!=='ok')continue;
    if(!prior)changes.push({kind:'added',siteId:site.id,sourceId:site.sourceId,before:null,after:projectVotingSite(site)});
    else{const changedFields=changedVotingFields(prior,site);if(changedFields.length)changes.push({kind:'changed',siteId:site.id,sourceId:site.sourceId,before:projectVotingSite(prior),after:projectVotingSite(site),changedFields})}
  }
  for(const site of old.locations){if(newById.has(site.id))continue;const source=sourceById.get(site.sourceId);if(source?.status==='ok')changes.push({kind:'missing_from_current_feed',siteId:site.id,sourceId:site.sourceId,before:projectVotingSite(site),after:null})}
  const digest=crypto.createHash('sha256').update(JSON.stringify(candidate.locations.map(site=>[site.id,projectVotingSite(site)]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
  const retainedSources=candidate.sources.filter(source=>source.status!=='ok').map(source=>source.id);
  return {...candidate,changeSet:{runId:crypto.randomUUID(),comparedTo:previous?.retrievedAt||null,generatedAt:candidate.retrievedAt,digest,retainedSources,items:previous?changes:[]}};
}

export function caseVotingDrift(intake,current,connector){
  if(!intake?.operationalSnapshot)return {status:'baseline_unavailable',changedFields:[],latestRetrievedAt:current?.retrievedAt||null,connectorStatus:connector?.status||'unknown'};
  if(!current)return {status:'missing_from_current_snapshot',changedFields:[],latestRetrievedAt:null,connectorStatus:connector?.status||'unknown'};
  const changedFields=votingFields.filter(field=>JSON.stringify(intake.operationalSnapshot[field]??null)!==JSON.stringify(current[field]??null));
  const connectorStatus=connector?.status||'unknown';
  return {status:connectorStatus!=='ok'?'source_stale':changedFields.length?'changed_since_intake':'unchanged_since_intake',changedFields,latestRetrievedAt:current.retrievedAt,connectorStatus};
}
