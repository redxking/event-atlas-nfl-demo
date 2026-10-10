export const eventTypeLabel=game=>({concert:'Concert',festival:'Community festival',voting:'Voting location',nfl:'NFL game'}[game.eventType]||'NFL game');
export function exampleSummary(game){return {label:'Monitoring not started',items:[],urgent:[],sources:[{name:'Local incident feeds',state:'not yet checked',detail:'This example has a published schedule or location; event-specific incident feeds are not connected.'}]};}
const additionalSummaries=new Map();
export function setAdditionalSummary(id,summary){additionalSummaries.set(id,summary);}
export function clearAdditionalSummary(id){additionalSummaries.delete(id);}
export function getAdditionalSummary(game){const s=additionalSummaries.get(game.id);if(!s||Date.now()-s.checkedAt>=600000)return exampleSummary(game);if(s.label==='Monitoring not started')return s;const items=s.items.filter(item=>Date.parse(item.validUntil)>Date.now());return {...s,items,urgent:items,label:items.length?`${items.length} weather concern${items.length===1?'':'s'}`:'Weather checked; other feeds pending'};}
