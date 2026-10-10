const roadRelationships=new Set(['time_place_candidate','excluded_link']);
const roadRules=new Set(['ROAD_RADIUS_WINDOW','ROAD_WINDOW_DISJOINT']);
const roadSource=picture=>(picture?.sources||[]).find(item=>item.name==='Road conditions');
const validTime=value=>Number.isFinite(Date.parse(value));

export function snapshotRoadRelationships(ledger){
  if(ledger?.schema!=='event-atlas.nfl-relationship-ledger.v1')return [];
  return (ledger.items||[]).filter(item=>roadRelationships.has(item.relationship)&&roadRules.has(item.ruleId)&&typeof item.recordId==='string'&&item.recordId.length<=120&&/^https:\/\//.test(item.sourceUrl||'')).slice(0,25).map(item=>({recordId:item.recordId,relationship:item.relationship,claim:String(item.claim||'').slice(0,300),sourceUrl:item.sourceUrl}));
}

export function diffRoadRelationships(previous,current,previousPicture,currentPicture,previousGame,currentGame,observedAt){
  if(previousGame?.kickoff!==currentGame?.kickoff||previousGame?.status!==currentGame?.status||previousGame?.timeTbd!==currentGame?.timeTbd)return [];
  const before=roadSource(previousPicture),after=roadSource(currentPicture);
  if(before?.state!=='time screened'||after?.state!=='time screened'||before.sourceUrl!==after.sourceUrl||!validTime(before.asOf)||!validTime(after.asOf)||Date.parse(after.asOf)<=Date.parse(before.asOf))return [];
  const key=item=>`${item.recordId}|${item.sourceUrl}`;
  const unique=items=>{const counts=new Map();for(const item of items)counts.set(key(item),(counts.get(key(item))||0)+1);return new Map(items.filter(item=>counts.get(key(item))===1).map(item=>[key(item),item]))};
  const old=unique(previous||[]),now=unique(current||[]),changes=[];
  for(const [id,item] of now){
    const prior=old.get(id);
    if(!prior||prior.relationship===item.relationship||item.sourceUrl!==after.sourceUrl)continue;
    changes.push({kind:'road_event_relationship_reclassified',observedAt,title:`Road record screening changed: ${item.claim}`.slice(0,300),detail:`The same publisher road record moved from ${prior.relationship.replaceAll('_',' ')} to ${item.relationship.replaceAll('_',' ')} in a newer successful road snapshot. Verify the current published time window, location, and event route. This is a screening change, not evidence of a road reopening, stadium impact, incident, or threat.`,sourceUrl:item.sourceUrl});
  }
  return changes.slice(0,10);
}
