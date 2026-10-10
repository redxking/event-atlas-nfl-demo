export function appendBriefSnapshot(history,brief){
 if(brief?.dataMode!=='synthetic_exercise'||history.some(s=>s.eventId!==brief.event.id))throw Error('Invalid or cross-event brief history');
 const snapshot=structuredClone(brief);delete snapshot.reportHistory;
 if(history.length&&JSON.stringify(history.at(-1).brief)===JSON.stringify(snapshot))return history;
 return [...history,{id:`${brief.event.id}:brief:${history.length+1}`,eventId:brief.event.id,dataMode:'synthetic_exercise',savedAt:new Date().toISOString(),brief:snapshot}];
}
export function historyArchive(history){
 if(!history.length)throw Error('No snapshots');
 const eventId=history[0].eventId;if(history.some(s=>s.eventId!==eventId||s.dataMode!=='synthetic_exercise'))throw Error('Mixed history');
 return {schema:'event-atlas.exercise-brief-history.v1',dataMode:'synthetic_exercise',eventId,snapshots:structuredClone(history),boundary:'Local session snapshots; unauthenticated exercise history. Not an immutable operational audit log.'};
}
