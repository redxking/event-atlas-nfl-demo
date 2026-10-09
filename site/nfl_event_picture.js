import {selectRoadContext} from './road_relevance.js';
import {selectWeatherContext} from './weather_relevance.js';

const HOUR=3600000;
const fresh=(value,now,maxAge)=>{
  const at=Date.parse(value);
  return Number.isFinite(at)&&at<=now+60000&&now-at<=maxAge;
};
const row=(name,state,asOf=null,detail='',sourceUrl=null)=>({name,state,asOf,detail,sourceUrl});

export function buildNflEventPicture(game,inputs={},now=Date.now()){
  const {schedule,ground,airspace,cameras,roads,conditions,police}=inputs;
  const venueId=game.venue.id;
  const footprint=ground?.byVenue?.[venueId];
  const faa=airspace?.byGame?.[game.id];
  const cameraItems=cameras?.byVenue?.[venueId];
  const cameraFresh=fresh(cameras?.builtAt,now,12*HOUR);
  const faaFresh=fresh(airspace?.builtAt,now,12*HOUR);
  const road=selectRoadContext(game,roads,now);
  const weather=conditions?.alertsError||!Array.isArray(conditions?.alerts?.features)?null:selectWeatherContext(game,conditions.alerts.features,conditions.at,now);
  const policeConnected=['3687','3673'].includes(venueId);
  const policeFresh=police?.state==='retrieved'&&Number.isFinite(police.checkedAt)&&police.checkedAt<=now+60000&&now-police.checkedAt<=15*60000;
  const sources=[
    row('NFL schedule',fresh(schedule?.builtAt,now,12*HOUR)?'current snapshot':'stale or unavailable',game.sourceRetrievedAt,'Confirm changes with the NFL or host club.',game.sourceUrl),
    row('Ground geometry',footprint?'unreviewed candidate':'unavailable',footprint?.sourceEditedAt,footprint?.identityMethod==='exact_name'?'Exact name only; venue identity needs review.':'Not an approved security perimeter.',footprint?.sourceUrl),
    row('FAA SEAMS',!faa?'no linked record':faaFresh?'current snapshot':'stale snapshot',airspace?.builtAt,`Airspace record last edited ${faa?.sourceUpdatedAt||'not supplied'}; current NOTAM not verified.`,airspace?.sourceItemUrl),
    row('NWS point alerts',conditions?.alertsError?'source failed':!conditions?'not yet checked':weather?.state==='stale'?'stale':weather?.state==='kickoff_unavailable'?'checked; time screen unavailable':'checked',conditions?.at?new Date(conditions.at).toISOString():null,'Point query; verify alert footprint.',Number.isFinite(game.venue.lat)&&Number.isFinite(game.venue.lon)?`https://api.weather.gov/alerts/active?point=${game.venue.lat},${game.venue.lon}`:null),
    row('Road conditions',road.timingState==='matched'?'time screened':road.timingState,roads?.builtAt,'Proximity and time overlap do not prove route impact.',road.records[0]?.sourceUrl),
    row('Roadway cameras',!cameras?'not yet loaded':!cameraFresh?'stale snapshot':cameraItems?'metadata connected':'no connector',cameras?.builtAt,'A listed camera is not a verified stadium view.',cameraItems?.[0]?.sourceUrl),
    row('Local police activity',!policeConnected?'no connector':police?.state==='failed'?'source failed':policeFresh?'public call count checked':'not current',policeFresh?new Date(police.checkedAt).toISOString():null,venueId==='3673'?'Seattle publishes closed CAD responses; these are not active police alerts or threat findings.':venueId==='3687'?'Arlington public calls are delayed; these are not threat findings.':'No jurisdictional source connected.',venueId==='3673'?'https://experience.arcgis.com/experience/6ee2574e047d4cdb9cb5ad287b76d091':venueId==='3687'?'https://policeincidents.arlingtontx.gov/':null)
  ];
  const cues=[];
  if(weather?.state==='screened')for(const entry of weather.alerts.filter(item=>item.candidate)){
    const p=entry.feature.properties||{};
    cues.push({type:'weather alert',title:p.event||'NWS alert',basis:`NWS ${p.severity||'unknown severity'} / ${p.urgency||'unknown urgency'}; overlaps illustrative event window`,sourceUrl:p['@id']||entry.feature.id||null,sourceAt:p.effective||null});
  }
  if(road.timingState==='matched')for(const item of road.records.filter(record=>record.overlaps).slice(0,4)){
    cues.push({type:'road condition',title:`${item.kind} · ${item.name}`,basis:`${item.agency}; ${item.distanceKm} km from candidate point; published window overlaps event`,sourceUrl:item.sourceUrl||null,sourceAt:item.sourceRecordDate||item.startAt||null});
  }
  const gaps=['Venue operator has not approved the ground perimeter, entrances, queues, or camera coverage.','No verified stadium CCTV stream is connected.','Current FAA NOTAM status requires independent verification.'];
  if(!policeConnected)gaps.push('No jurisdictional police incident feed is connected for this venue.');
  else if(!policeFresh)gaps.push(`${venueId==='3673'?'Seattle':'Arlington'} public police-call context is unavailable or not current.`);
  if(!cameraFresh||!cameraItems)gaps.push('No current roadway-camera metadata coverage is available for this venue.');
  if(road.timingState!=='matched')gaps.push(`Road event-time matching is unavailable (${road.timingState.replaceAll('_',' ')}).`);
  if(!weather||weather.state!=='screened')gaps.push('NWS alert event-time screening is unavailable or incomplete.');
  if(!faa||!faaFresh)gaps.push('FAA SEAMS event snapshot is absent or stale.');
  return {kind:'public_source_event_picture',generatedAt:new Date(now).toISOString(),eventId:game.id,venueId,cues,cueCounts:{weather:weather?.state==='screened'?weather.candidateCount:0,road:road.timingState==='matched'?road.overlapCount:0},sources,gaps,policeContext:policeFresh?police.context:null,assessment:{severity:'not_assessed',confidence:'not_assessed'},interpretation:'Review cues are source observations for analyst verification, not assessed threats or verified event impacts.'};
}
