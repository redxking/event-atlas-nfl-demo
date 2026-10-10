export function windowRelationships(games,currentId,briefs=[]){
 const current=games.find(g=>g.id===currentId);if(!current)throw Error('Unknown scoped game');
 const currentBrief=briefs.find(b=>b.event.id===currentId),claim=currentBrief?.observations.find(r=>r.recordId==='S-14');
 if(briefs.some(b=>b.dataMode!=='synthetic_exercise'||!games.some(g=>g.id===b.event.id)))throw Error('Non-exercise or out-of-scope related evidence');
 const venueLinks=games.filter(g=>g.id!==currentId&&g.venue.id===current.venue.id).map(g=>({kind:'shared_venue_schedule',eventId:g.id,title:g.title,kickoff:g.kickoff,venue:g.venue.name,basis:'Schedule metadata: same venue identifier. This does not link incidents or establish a threat.'}));
 const evidenceLinks=claim?briefs.filter(b=>b.event.id!==currentId).flatMap(b=>{
  const other=b.observations.find(r=>r.recordId==='S-14');
  if(!other||other.claim!==claim.claim)return [];
  return [{kind:'repeated_synthetic_claim',dataMode:'synthetic_exercise',eventId:b.event.id,title:games.find(g=>g.id===b.event.id).title,evidenceIds:[claim.evidenceId,other.evidenceId],claims:[claim.claim,other.claim],basis:'Identical fictional campaign claim from the shared exercise template. This is a duplicate scenario signal, not independent corroboration or real cross-event attribution.'}];
 }):[];
 return {schema:'event-atlas.window-relationships.v1',eventId:currentId,venueLinks,evidenceLinks,scope:'Only games in the fixed two-week demonstration; synthetic evidence from injected page sessions only'};
}
