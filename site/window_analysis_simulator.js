export const scenarioStages=[
 {id:'baseline',label:'Before injection',count:0,description:'Empty baseline; source coverage has not been demonstrated.'},
 {id:'emerging',label:'Emerging observations',count:19,description:'Initial fictional observations create unreviewed verification candidates.'},
 {id:'contrary',label:'Duplicate and contrary evidence',count:21,description:'A duplicate is excluded and a scheduled-load-test explanation challenges the cyber inference.'},
 {id:'correction',label:'Corrections and CAD recovery',count:25,description:'Dispatch and network observations are corrected. Earlier evidence remains in history.'},
 {id:'camera_outage',label:'Camera outage',count:33,description:'Supplemental feeds are present; the camera connection is unavailable.'},
 {id:'recovered',label:'New frame after recovery',count:35,description:'A new camera frame permits synthetic playback. The missing interval remains unknown.'},
 {id:'stale',label:'Stale-feed exercise',count:35,advanceMinutes:31,description:'All connected feed records age beyond the demonstration freshness threshold.'}
];
export function simulateExerciseAnalysis(brief){
 if(brief?.dataMode!=='synthetic_exercise')throw Error('Simulation accepts exercise records only');
 const records=new Map(brief.observations.map(r=>[r.evidenceId,r])),sources=new Map(brief.sources.map(s=>[s.id,s]));
 const items=brief.candidates.map(candidate=>{
  const evidence=[...candidate.evidenceIds,...candidate.contraryEvidenceIds].map(id=>{const r=records.get(id);if(!r)throw Error('Missing simulation evidence');return {id,claim:r.claim,revision:r.revision,sourceState:sources.get(r.sourceId)?.state||'unknown'}});
  const degraded=evidence.some(r=>['stale','unavailable','unknown'].includes(r.sourceState));
  const reason=degraded?'Refresh or restore supporting evidence':candidate.contraryEvidenceIds.length?'Reconcile contrary evidence':evidence.some(r=>r.revision>1)?'Reassess corrected evidence':'Verify the reported observation';
  return {candidateId:candidate.id,title:candidate.title,reviewReason:reason,evidence,contraryEvidenceIds:[...candidate.contraryEvidenceIds],verificationAction:candidate.next,reviewStatus:candidate.review?.status||'not_reviewed',priority:degraded?0:candidate.contraryEvidenceIds.length?1:evidence.some(r=>r.revision>1)?2:3};
 }).sort((a,b)=>a.priority-b.priority||a.candidateId.localeCompare(b.candidateId)).map(({priority,...item})=>item);
 return {schema:'event-atlas.simulated-analysis.v1',dataMode:'synthetic_exercise',executionMode:'simulated_backend',modelInvoked:false,eventId:brief.event.id,feedVersion:brief.version,clock:brief.clock,items,coverage:{waiting:brief.sources.filter(s=>s.state==='waiting').length,unavailable:brief.sources.filter(s=>s.state==='unavailable').length,stale:brief.sources.filter(s=>s.state==='stale').length},uncertainty:'All records are fictional and unverified. Ordering represents demonstration verification work, not risk, threat severity, identity or enforcement priority.',humanConfirmation:'Exercise review required; no authenticated approval or external action occurs.'};
}
