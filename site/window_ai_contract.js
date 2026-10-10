export const DEMO_MODEL='qwen3.5:9b';
export function buildExerciseModelPacket(brief){
 if(brief?.dataMode!=='synthetic_exercise')throw Error('Synthetic brief required');
 return {schema:'event-atlas.exercise-model-packet.v1',dataMode:'synthetic_exercise',eventId:brief.event.id,clock:brief.clock,
 evidence:brief.observations.map(r=>({id:r.evidenceId,claim:r.claim,revision:r.revision})),
 sources:brief.sources.map(s=>({id:s.id,state:s.state})),
 candidates:brief.candidates.map(c=>({id:c.id,title:c.title,basis:c.basis,next:c.next,evidenceIds:c.evidenceIds,contraryEvidenceIds:c.contraryEvidenceIds})),
 limits:'Fictional exercise only. Rank verification work, not people or threats. Spatial area edits and operator decisions are not model inputs.'};
}
export function validateExerciseModelSelection(output,packet){
 if(!output||Object.keys(output).sort().join()!=='rankedCandidateIds'||!Array.isArray(output.rankedCandidateIds)||output.rankedCandidateIds.length<1||output.rankedCandidateIds.length>3||new Set(output.rankedCandidateIds).size!==output.rankedCandidateIds.length||output.rankedCandidateIds.some(id=>!packet.candidates.some(c=>c.id===id)))throw Error('Invalid model candidate selection');
 return {rankedCandidateIds:[...output.rankedCandidateIds]};
}
export function bindExerciseModelSnapshot(brief,snapshot){
 const packet=buildExerciseModelPacket(brief);
 if(!snapshot)return {status:'not_available',modelInvoked:false};
 if(snapshot.model!==DEMO_MODEL||snapshot.status!=='model_generated_unreviewed'||snapshot.packetJson!==JSON.stringify(packet))return {status:'input_changed_or_snapshot_invalid',modelInvoked:false};
 try{const proposal=validateExerciseModelSelection(snapshot.proposal,packet);return {...snapshot,proposal,status:'recorded_model_run_matches_inputs',modelInvoked:false,executionMode:'Recorded local inference; this browser did not invoke a model',rankedCandidates:proposal.rankedCandidateIds.map(id=>packet.candidates.find(c=>c.id===id)),limitations:'Model ranks verification candidates only. Wording and evidence links are copied from application records; no model-generated threat assessment. Human review remains required.'}}catch{return {status:'invalid_model_output',modelInvoked:false}}
}
