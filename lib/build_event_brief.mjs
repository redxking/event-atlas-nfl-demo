const feedState=feed=>!feed?'not_queried':feed.stale?'stale_or_unavailable':'retrieved';
const evidence=(source,id,title,url,reportedAt,qualifier)=>({source,id,title,url:url||null,reportedAt:reportedAt||null,qualifier});
function utcMillis(value,timeZone){if(!value)return null;try{if(/(?:Z|[+-]\d\d:\d\d)$/.test(value)){const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:null}if(!globalThis.Temporal||!timeZone)return null;return Number(Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone,{disambiguation:'reject'}).toInstant().epochMilliseconds)}catch{return null}}
function overlapsAlert(alert,start,end){const effective=Date.parse(alert.effective),expires=Date.parse(alert.expires);return Number.isFinite(start)&&(end===null||end>=start)&&Number.isFinite(effective)&&Number.isFinite(expires)&&expires>=effective&&effective<=(end??start)&&expires>=start}

export function buildEventBrief(event,place,conditions,generatedAt=new Date().toISOString()){
  const hasPoint=Number.isFinite(place?.lat)&&Number.isFinite(place?.lon);
  const weather=conditions?.weather,earthquakes=conditions?.earthquakes,natural=conditions?.naturalEvents;
  const start=utcMillis(event.startsAtLocal,event.timeZone),end=utcMillis(event.endsAtLocal,event.timeZone);
  const observations=[];
  const reviewCandidates=[];
  if(weather){for(const alert of weather.items||[]){const item=evidence('nws',alert.id,alert.headline||alert.event,alert.url,alert.effective,'NWS alert returned for this point; verify geographic footprint and event time');item.sourceSeverity=alert.severity||null;item.sourceUrgency=alert.urgency||null;item.expires=alert.expires||null;observations.push(item);if(!weather.stale&&!/^cancel/i.test(event.status)&&['Extreme','Severe'].includes(alert.severity)&&['Immediate','Expected'].includes(alert.urgency)&&overlapsAlert(alert,start,end))reviewCandidates.push({evidenceId:item.id,reason:'NWS source reports a severe or extreme alert with immediate or expected urgency at the event point and overlapping the sourced event time',action:'Analyst review of alert footprint, validity, schedule, and protective operations',status:'unreviewed'})}}
  if(earthquakes)for(const quake of (earthquakes.items||[]).slice(0,5))observations.push(evidence('usgs',quake.id,quake.title,quake.url,quake.time,'Within 250 km; no impact or damage inferred'));
  if(natural)for(const item of (natural.items||[]).slice(0,5))observations.push(evidence('nasa-eonet',item.id,item.title,item.url,item.date,'Open event point within 250 km; no local impact inferred'));
  const gaps=[];
  if(!hasPoint)gaps.push('No source coordinates: point-based hazards were not queried.');
  if(!place?.address)gaps.push('Source does not provide a complete place address.');
  if(!event.endsAtLocal)gaps.push('Source does not provide an event end time.');
  if(start===null||event.endsAtLocal&&end===null)gaps.push('Event schedule could not be resolved to an unambiguous UTC time; temporal alert matching is disabled.');
  if(start!==null&&end!==null&&end<start)gaps.push('Published end time precedes start time; temporal alert matching is disabled.');
  if(!event.organizer)gaps.push('Organizer is not stated by source.');
  if(!event.venueId)gaps.push('No verified link to a venue registry record.');
  else if(event.venueLinkStatus?.includes('unreviewed'))gaps.push('Venue registry link is an unreviewed name-match candidate.');
  for(const [name,feed] of [['NWS',weather],['USGS',earthquakes],['NASA EONET',natural]])if(feedState(feed)!=='retrieved')gaps.push(`${name} point context ${feedState(feed).replaceAll('_',' ')}; no negative finding can be inferred.`);
  return {kind:'event_situation_brief',generatedAt,event:{id:event.id,title:event.title,startsAtLocal:event.startsAtLocal,endsAtLocal:event.endsAtLocal||null,timeZone:event.timeZone,startUtc:start===null?null:new Date(start).toISOString(),endUtc:end===null?null:new Date(end).toISOString(),sourceStatus:event.status,sourceUrl:event.sourceUrl,sourceDataset:event.sourceDataset,retrievedAt:event.retrievedAt},place:place?{id:place.id,name:place.name,address:place.address||null,lat:hasPoint?place.lat:null,lon:hasPoint?place.lon:null}:null,feeds:{nws:{state:feedState(weather),retrievedAt:weather?.retrievedAt||null,error:weather?.error||null},usgs:{state:feedState(earthquakes),retrievedAt:earthquakes?.retrievedAt||null,error:earthquakes?.error||null},nasaEonet:{state:feedState(natural),retrievedAt:natural?.retrievedAt||null,error:natural?.error||null}},observations,reviewCandidates,gaps,assessment:{severity:'not_assessed',confidence:'not_assessed',analyst:null,protectiveAction:null},interpretation:'Source-backed operational context only. Review candidates are not threat findings, and proximity is not evidence of impact.'};
}
