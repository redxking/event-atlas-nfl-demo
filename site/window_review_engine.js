// Local exercise decisions only. This is not authenticated analyst approval.
const mode='synthetic_exercise';
export const reviewDecisions=['needs_verification','exercise_follow_up','dismissed_in_exercise'];
function binding(brief,candidate){
 const records=new Map(brief.observations.map(r=>[r.evidenceId,r]));
 const ids=[...candidate.evidenceIds,...candidate.contraryEvidenceIds].sort();
 return JSON.stringify({area:brief.monitoringArea||null,evidence:ids.map(id=>{
  const record=records.get(id);if(!record)throw Error('Missing review evidence');
  const source=brief.sources.find(s=>s.id===record.sourceId);if(!source)throw Error('Missing evidence source');
  return {id,revision:record.revision,claim:record.claim,sourceState:source.state};
 })});
}
export function recordExerciseReview(brief,candidateId,decision,history=[]){
 if(brief?.dataMode!==mode||!reviewDecisions.includes(decision)||!Array.isArray(history))throw Error('Invalid exercise review');
 const candidate=brief.candidates.find(c=>c.id===candidateId);if(!candidate)throw Error('Unknown candidate');
 if(history.some(r=>r.eventId!==brief.event.id||r.dataMode!==mode))throw Error('Cross-event review history');
 return [...history,{
  schema:'event-atlas.exercise-review.v1',dataMode:mode,eventId:brief.event.id,
  id:`${brief.event.id}:review:${history.length+1}`,candidateId,decision,
  actor:'Demo operator (unauthenticated)',recordedAt:new Date().toISOString(),
  exerciseClock:brief.clock,briefVersion:brief.version,evidenceBinding:binding(brief,candidate),
  evidenceIds:[...candidate.evidenceIds],contraryEvidenceIds:[...candidate.contraryEvidenceIds]
 }];
}
export function applyExerciseReviews(brief,history=[]){
 if(brief?.dataMode!==mode||history.some(r=>r.eventId!==brief.event.id||r.dataMode!==mode))throw Error('Cross-event or live review');
 return {...brief,reviewMode:'local_session_simulation; no authenticated approval',reviewHistory:history,
 candidates:brief.candidates.map(candidate=>{
  const last=history.filter(r=>r.candidateId===candidate.id).at(-1);
  return {...candidate,review:last?{id:last.id,decision:last.decision,status:last.evidenceBinding===binding(brief,candidate)?'current_exercise_review':'evidence_changed_review_required'}:{status:'not_reviewed'}};
 })};
}
