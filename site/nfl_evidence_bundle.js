import {buildNflEventPicture} from './nfl_event_picture.js?v=20261009-18';
import {buildVenueZoneRegistry} from './zone_registry.js';

const pick=(value,fields)=>Object.fromEntries(fields.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};

export function buildNflEvidenceBundle(game,inputs={},now=Date.now()){
  const picture=buildNflEventPicture(game,inputs,now);
  const venueId=game.venue.id;
  const ground=inputs.ground?.byVenue?.[venueId];
  const airspace=inputs.airspace?.byGame?.[game.id];
  const cameras=inputs.cameras?.byVenue?.[venueId];
  const roads=inputs.roads?.byVenue?.[venueId];
  const alerts=inputs.conditions?.alerts?.features;
  const ntasCurrent=inputs.ntas?.status==='ok'&&Array.isArray(inputs.ntas.active)&&Number.isFinite(Date.parse(inputs.ntas.retrievedAt))&&now-Date.parse(inputs.ntas.retrievedAt)>=-60000&&now-Date.parse(inputs.ntas.retrievedAt)<=12*3600000;
  const earthquakes=inputs.conditions?.quakes?.features;
  return {
    schema:'event-atlas.public-evidence-bundle.v1',
    status:'unreviewed_public_source_export',
    generatedAt:new Date(now).toISOString(),
    useLimit:'Public-source observations for analyst verification. No threat determination, incident attribution, operational geofence, camera field of view, or dissemination approval.',
    event:pick(game,['id','title','week','kickoff','timeTbd','status','sourceUrl','sourceRetrievedAt']),
    venue:pick(game.venue,['id','name','address','lat','lon','coordinateStatus','venueCandidateUrl']),
    picture,
    sourceSnapshots:{schedule:inputs.schedule?.builtAt||null,ground:inputs.ground?.builtAt||null,airspace:inputs.airspace?.builtAt||null,tfr:inputs.tfr?.builtAt||null,cameras:inputs.cameras?.builtAt||null,roads:inputs.roads?.builtAt||null,weather:inputs.conditions?.at?new Date(inputs.conditions.at).toISOString():null,usgs:inputs.conditions?.at?new Date(inputs.conditions.at).toISOString():null,police:inputs.police?.checkedAt?new Date(inputs.police.checkedAt).toISOString():null,cmpdOpenTraffic:inputs.cmpdTraffic?.checkedAt?new Date(inputs.cmpdTraffic.checkedAt).toISOString():null,mbtaFoxboro:inputs.transit?.checkedAt?new Date(inputs.transit.checkedAt).toISOString():null,mbtaFoxboroSchedule:inputs.transitSchedule?.checkedAt?new Date(inputs.transitSchedule.checkedAt).toISOString():null,mbtaFoxboroPredictions:inputs.transitPredictions?.checkedAt?new Date(inputs.transitPredictions.checkedAt).toISOString():null,ntas:inputs.ntas?.retrievedAt||null},
    geography:{
      zoneRegistry:buildVenueZoneRegistry(game,inputs),
      ground:ground?{status:'unreviewed_osm_candidate',sourceUrl:ground.sourceUrl,sourceVersion:ground.sourceVersion,sourceEditedAt:ground.sourceEditedAt,identityMethod:ground.identityMethod,outerRings:ground.outerRings||[ground.ring]}:null,
      airspace:airspace?{status:'FAA SEAMS source record; current NOTAM unverified',sourceUrl:inputs.airspace.sourceItemUrl,record:pick(airspace,['objectId','eventName','startAt','endAt','status','isActive','sourceUpdatedAt','center','ring'])}:null,
      tfrCandidates:inputs.tfr?.byVenue?.[venueId]||[]
    },
    publicObservations:{
      weather:Array.isArray(alerts)?alerts.map(feature=>{const p=feature.properties||{};return {sourceId:feature.id||null,sourceUrl:p['@id']||null,event:p.event||null,severity:p.severity||null,urgency:p.urgency||null,status:p.status||null,effective:p.effective||null,ends:p.ends||p.expires||null}}):null,
      earthquakes:Array.isArray(earthquakes)?earthquakes.filter(feature=>{const [lon,lat]=feature.geometry?.coordinates||[];return Number.isFinite(lat)&&Number.isFinite(lon)&&distance(game.venue.lat,game.venue.lon,lat,lon)<=250}).sort((a,b)=>{const [alon,alat]=a.geometry.coordinates,[blon,blat]=b.geometry.coordinates;return distance(game.venue.lat,game.venue.lon,alat,alon)-distance(game.venue.lat,game.venue.lon,blat,blon)}).slice(0,3).map(feature=>({sourceId:feature.id||null,sourceUrl:feature.properties?.url||null,title:feature.properties?.title||null,magnitude:feature.properties?.mag??null,occurredAt:Number.isFinite(feature.properties?.time)?new Date(feature.properties.time).toISOString():null,point:feature.geometry.coordinates.slice(0,2)})):null,
      nationalAdvisory:{state:ntasCurrent?'current national snapshot':'stale or unavailable',sourceUrl:inputs.ntas?.sourceUrl||'https://www.dhs.gov/ntas/1.1/feed.xml',active:ntasCurrent?inputs.ntas.active.map(item=>pick(item,['type','start','end','locations','sectors','summary','url'])):null},
      roads:Array.isArray(roads)?roads.map(item=>pick(item,['id','agency','kind','name','detail','lat','lon','distanceKm','startAt','endAt','sourceRecordDate','sourceUrl'])):null,
      cameras:Array.isArray(cameras)?cameras.map(item=>pick(item,['id','agency','name','lat','lon','distanceKm','inService','operationalStatus','statusAsOf','metadataDate','sourceUrl','viewerUrl','stillUrl','videoUrl'])):null,
      policeAggregate:picture.policeContext,
      openRoadwayAggregate:picture.openRoadwayContext,
      stationAlerts:picture.transitContext,
      stationSchedule:picture.transitScheduleContext,
      stationPredictions:picture.transitPredictionsContext
    },
    protectedPeople:{state:'not_collected_in_public_demo',reason:'Named-person material requires a documented protective nexus, controlled access, source review, and supervisor approval.'}
  };
}
