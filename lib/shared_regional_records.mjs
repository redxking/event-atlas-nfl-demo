const validTime=value=>Number.isFinite(Date.parse(value));
const distanceKm=(a,b,c,d)=>{const rad=Math.PI/180,deltaLat=(c-a)*rad,deltaLon=(d-b)*rad,x=Math.sin(deltaLat/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(deltaLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
const eventUrl=id=>`https://earthquake.usgs.gov/earthquakes/eventpage/${id}`;
const reportUrl=path=>new URL(path,'https://redxking.github.io/event-atlas-nfl-demo/').href;

export function buildSharedRegionalRecords(reports,states,now=Date.now(),priorStates=[]){
  const reportById=new Map((reports||[]).filter(item=>typeof item?.eventId==='string').map(item=>[item.eventId,item]));
  const priorById=new Map((priorStates||[]).filter(item=>item&&['event-atlas.published-report-state.v7','event-atlas.published-report-state.v8'].includes(item.schema)).map(item=>[item.eventId,item]));
  const groups=new Map(),checked=[];
  for(const state of states||[]){
    const report=reportById.get(state?.eventId),context=state?.picture?.usgsContext;
    if(!report||context?.state!=='current_snapshot'||!validTime(context.asOf)||Date.parse(context.asOf)>now+60000||now-Date.parse(context.asOf)>12*3600000||!Array.isArray(context.events)||context.events.length>20)continue;
    checked.push(report);
    for(const record of context.events){
      if(!/^[a-z0-9]{5,24}$/i.test(record?.sourceId||'')||record.sourceUrl!==eventUrl(record.sourceId)||!validTime(record.occurredAt)||!validTime(record.updatedAt)||Date.parse(record.occurredAt)>now+60000||!Number.isFinite(record.distanceKm)||record.distanceKm<0||record.distanceKm>250||!Array.isArray(record.point)||record.point.length!==2||!Number.isFinite(record.point[0])||!Number.isFinite(record.point[1])||!Number.isFinite(Date.parse(report.kickoff)))continue;
      const id=`${record.sourceId}|${record.occurredAt}`;
      if(!groups.has(id))groups.set(id,{record,links:new Map(),currentByEvent:new Map()});
      const group=groups.get(id);
      if(group.record.sourceUrl!==record.sourceUrl||group.record.point[0]!==record.point[0]||group.record.point[1]!==record.point[1]||group.record.magnitude!==record.magnitude||group.record.title!==record.title||group.record.updatedAt!==record.updatedAt)continue;
      const offset=Date.parse(record.occurredAt)-Date.parse(report.kickoff);
      group.links.set(report.eventId,{eventId:report.eventId,eventTitle:report.title,venueName:report.venueName,kickoff:report.kickoff,reportGeneratedAt:report.generatedAt||null,distanceKm:record.distanceKm,windowRelation:offset>=-4*3600000&&offset<=5*3600000?'within_illustrative_event_window':'outside_illustrative_event_window',relationship:'regional_context',possibleImpact:'not_assessed',reportUrl:reportUrl(report.path)});
      group.currentByEvent.set(report.eventId,{record,asOf:context.asOf});
    }
  }
  return [...groups.values()].filter(group=>group.links.size>=2).sort((a,b)=>Date.parse(b.record.updatedAt)-Date.parse(a.record.updatedAt)).slice(0,6).map(({record,links,currentByEvent})=>{
    const linked=[...links.values()].sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)).slice(0,20);
    const revisions=[];
    for(const event of linked){
      const previous=priorById.get(event.eventId),priorContext=previous?.picture?.usgsContext,current=currentByEvent.get(event.eventId);
      if(priorContext?.state!=='current_snapshot'||!validTime(priorContext.asOf)||Date.parse(priorContext.asOf)>=Date.parse(current.asOf)||now-Date.parse(priorContext.asOf)>14*86400000||!Array.isArray(priorContext.events)||priorContext.events.length>20)continue;
      const old=priorContext.events.find(item=>item.sourceId===record.sourceId&&item.sourceUrl===record.sourceUrl);
      if(!old||!validTime(old.updatedAt)||Date.parse(record.updatedAt)<=Date.parse(old.updatedAt))continue;
      const changedFields=['magnitude','title','occurredAt','point'].filter(field=>JSON.stringify(old[field])!==JSON.stringify(record[field]));
      if(!changedFields.length)continue;
      revisions.push({eventId:event.eventId,changedFields,previous:{magnitude:old.magnitude,title:old.title,occurredAt:old.occurredAt,distanceKm:old.distanceKm,sourceUpdatedAt:old.updatedAt},current:{magnitude:record.magnitude,title:record.title,occurredAt:record.occurredAt,distanceKm:event.distanceKm,sourceUpdatedAt:record.updatedAt},systemObservedAt:new Date(now).toISOString(),status:'unreviewed_publisher_revision'});
    }
    const excluded=checked.filter(item=>!links.has(item.eventId)&&Number.isFinite(item.venueLat)&&Number.isFinite(item.venueLon)&&item.venueLat>=-90&&item.venueLat<=90&&item.venueLon>=-180&&item.venueLon<=180).map(item=>({item,distance:distanceKm(item.venueLat,item.venueLon,record.point[1],record.point[0])})).filter(candidate=>candidate.distance>250).sort((a,b)=>Date.parse(a.item.kickoff)-Date.parse(b.item.kickoff))[0];
    return {sourceType:'USGS earthquake record',sourceId:record.sourceId,sourceUrl:record.sourceUrl,title:String(record.title||'USGS earthquake record').slice(0,180),occurredAt:record.occurredAt,updatedAt:record.updatedAt,sourceIndependence:'one_publisher_record_across_events',relationship:'regional_context',linkedEvents:linked,additionalLinkedEventCount:Math.max(0,links.size-linked.length),revisions,excludedSample:excluded?{eventId:excluded.item.eventId,eventTitle:excluded.item.title,venueName:excluded.item.venueName,distanceKm:Math.round(excluded.distance*10)/10,reason:'outside_250_km_candidate_point_rule',reportUrl:reportUrl(excluded.item.path)}:null,limitations:'One USGS record appears in multiple event-area samples. Each distance uses an unreviewed venue point. A match or exclusion under this 250 km display rule does not establish shaking, venue impact, a threat, or an all-clear.'};
  });
}

export function retainSharedRegionalRevisions(currentGroups,previousFeed,now=Date.now()){
  if(previousFeed?.schema!=='event-atlas.published-change-feed.v1'||previousFeed.status!=='unreviewed_public_source_changes'||!validTime(previousFeed.builtAt)||Date.parse(previousFeed.builtAt)>now+60000||now-Date.parse(previousFeed.builtAt)>14*86400000||!Array.isArray(previousFeed.sharedRegionalRecords)||previousFeed.sharedRegionalRecords.length>6)return currentGroups;
  const allowed=new Set(['magnitude','title','occurredAt','point']);
  return currentGroups.map(group=>{
    const prior=previousFeed.sharedRegionalRecords.find(item=>item.sourceId===group.sourceId&&item.sourceUrl===group.sourceUrl),linked=new Set(group.linkedEvents.map(item=>item.eventId));
    const revisions=[...(group.revisions||[])],seen=new Set(revisions.map(item=>JSON.stringify([item.eventId,item.previous.sourceUpdatedAt,item.current.sourceUpdatedAt])));
    for(const item of (prior?.revisions||[]).slice(0,8)){
      if(item?.status!=='unreviewed_publisher_revision'||!linked.has(item.eventId)||!Array.isArray(item.changedFields)||!item.changedFields.length||item.changedFields.length>4||!item.changedFields.every(field=>allowed.has(field))||!validTime(item.systemObservedAt)||Date.parse(item.systemObservedAt)>now+60000||now-Date.parse(item.systemObservedAt)>14*86400000||!validTime(item.previous?.sourceUpdatedAt)||!validTime(item.current?.sourceUpdatedAt)||Date.parse(item.current.sourceUpdatedAt)<=Date.parse(item.previous.sourceUpdatedAt)||Date.parse(item.current.sourceUpdatedAt)>Date.parse(group.updatedAt)||!Number.isFinite(item.previous?.magnitude)||!Number.isFinite(item.current?.magnitude)||!Number.isFinite(item.previous?.distanceKm)||!Number.isFinite(item.current?.distanceKm)||item.previous.distanceKm<0||item.previous.distanceKm>250||item.current.distanceKm<0||item.current.distanceKm>250||typeof item.previous?.title!=='string'||item.previous.title.length>240||typeof item.current?.title!=='string'||item.current.title.length>240||!validTime(item.previous?.occurredAt)||!validTime(item.current?.occurredAt))continue;
      const key=JSON.stringify([item.eventId,item.previous.sourceUpdatedAt,item.current.sourceUpdatedAt]);
      if(seen.has(key))continue;
      seen.add(key);
      revisions.push({...item,provenance:'retained_prior_published_feed'});
    }
    revisions.sort((a,b)=>Date.parse(b.systemObservedAt)-Date.parse(a.systemObservedAt)||a.eventId.localeCompare(b.eventId));
    return {...group,revisions:revisions.slice(0,8)};
  });
}
