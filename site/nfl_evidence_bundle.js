import {buildNflEventPicture} from './nfl_event_picture.js?v=20261010-58';
import {buildVenueZoneRegistry} from './zone_registry.js';
import {selectNflNews} from './nfl_news_context.js?v=20261010-2';

const pick=(value,fields)=>Object.fromEntries(fields.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));

export function buildNflEvidenceBundle(game,inputs={},now=Date.now()){
  const picture=buildNflEventPicture(game,inputs,now);
  const venueId=game.venue.id;
  const ground=inputs.ground?.byVenue?.[venueId];
  const airspace=inputs.airspace?.byGame?.[game.id];
  const cameras=inputs.cameras?.byVenue?.[venueId];
  const roads=inputs.roads?.byVenue?.[venueId];
  const alerts=inputs.conditions?.alerts?.features;
  const ntasCurrent=inputs.ntas?.status==='ok'&&Array.isArray(inputs.ntas.active)&&Number.isFinite(Date.parse(inputs.ntas.retrievedAt))&&now-Date.parse(inputs.ntas.retrievedAt)>=-60000&&now-Date.parse(inputs.ntas.retrievedAt)<=12*3600000;
  const news=selectNflNews(game,inputs.news,now);
  return {
    schema:'event-atlas.public-evidence-bundle.v1',
    status:'unreviewed_public_source_export',
    generatedAt:new Date(now).toISOString(),
    useLimit:'Public-source observations for analyst verification. No threat determination, incident attribution, operational geofence, camera field of view, or dissemination approval.',
    event:pick(game,['id','title','week','kickoff','timeTbd','status','gameState','sourceUrl','sourceRetrievedAt']),
    venue:pick(game.venue,['id','name','address','lat','lon','coordinateStatus','venueCandidateUrl']),
    picture,
    sourceSnapshots:{schedule:inputs.schedule?.builtAt||null,ground:inputs.ground?.builtAt||null,airspace:inputs.airspace?.builtAt||null,tfr:inputs.tfr?.builtAt||null,cameras:inputs.cameras?.builtAt||null,roads:inputs.roads?.builtAt||null,news:news.asOf,weather:inputs.conditions?.at?new Date(inputs.conditions.at).toISOString():null,nwsObservation:picture.observationContext?.observedAt||null,forecast:picture.forecastContext.checkedAt,spc:inputs.spc?.builtAt||null,wpcRain:inputs.wpcRain?.builtAt||null,eonet:inputs.eonet?.builtAt||null,nifc:inputs.nifc?.builtAt||null,airnow:inputs.airnow?.builtAt||null,hmsSmoke:inputs.hmsSmoke?.builtAt||null,greenBayAlerts:inputs.greenBayAlerts?.builtAt||null,lambeauPlan:inputs.lambeauPlan?.checkedAt||null,packersGameRelease:inputs.packersGameRelease?.checkedAt||null,patriotsGamePreview:inputs.patriotsGamePreview?.checkedAt||null,usgs:picture.usgsContext.asOf,police:inputs.police?.checkedAt?new Date(inputs.police.checkedAt).toISOString():null,cmpdOpenTraffic:inputs.cmpdTraffic?.checkedAt?new Date(inputs.cmpdTraffic.checkedAt).toISOString():null,mbtaFoxboro:inputs.transit?.checkedAt?new Date(inputs.transit.checkedAt).toISOString():null,mbtaFoxboroSchedule:inputs.transitSchedule?.checkedAt?new Date(inputs.transitSchedule.checkedAt).toISOString():null,mbtaFoxboroPredictions:inputs.transitPredictions?.checkedAt?new Date(inputs.transitPredictions.checkedAt).toISOString():null,septaBLine:inputs.septa?.sourceAt||null,njTransitRail:inputs.njTransitRail?.sourceAt||null,nj511:inputs.nj511?.sourceAt||null,ntas:inputs.ntas?.retrievedAt||null},
    geography:{
      zoneRegistry:buildVenueZoneRegistry(game,inputs),
      ground:ground?{status:'unreviewed_osm_candidate',sourceUrl:ground.sourceUrl,sourceVersion:ground.sourceVersion,sourceEditedAt:ground.sourceEditedAt,identityMethod:ground.identityMethod,outerRings:ground.outerRings||[ground.ring]}:null,
      airspace:airspace?{status:'FAA SEAMS source record; current NOTAM unverified',sourceUrl:inputs.airspace.sourceItemUrl,record:pick(airspace,['objectId','eventName','startAt','endAt','status','isActive','sourceUpdatedAt','center','ring'])}:null,
      tfrCandidates:inputs.tfr?.byVenue?.[venueId]||[]
    },
    publicObservations:{
      gameArticle:picture.gameArticle,
      selectedGameDirectCheck:picture.directGame,
      nflHeadlines:{state:news.state,coverage:news.coverage,sourceUrl:news.sourceUrl,sources:news.sources,articles:news.articles},
      weather:Array.isArray(alerts)?alerts.map(feature=>{const p=feature.properties||{};return {sourceId:feature.id||null,sourceUrl:p['@id']||null,event:p.event||null,severity:p.severity||null,urgency:p.urgency||null,status:p.status||null,effective:p.effective||null,ends:p.ends||p.expires||null}}):null,
      kickoffForecast:picture.forecastContext,
      currentStationObservation:picture.observationContext,
      convectiveOutlook:picture.convectiveOutlook,
      excessiveRainOutlook:picture.excessiveRainOutlook,
      naturalEvents:picture.naturalEventsContext,
      wildfires:picture.wildfireContext,
      airQuality:picture.airQualityContext,
      satelliteSmoke:picture.smokeContext,
      environmentalCorrelation:picture.environmentalCorrelation,
      greenBayCityAlerts:picture.greenBayAlertContext,
      lambeauPublishedPlan:picture.lambeauPlanContext,
      packersGameSpecificAnnouncements:picture.packersReleaseContext,
      patriotsGameSpecificAnnouncements:picture.patriotsPreviewContext,
      clubAviationComparison:picture.clubAviationContext,
      earthquakes:picture.usgsContext.state==='current_snapshot'?picture.usgsContext.events:null,
      nationalAdvisory:{state:ntasCurrent?'current national snapshot':'stale or unavailable',sourceUrl:inputs.ntas?.sourceUrl||'https://www.dhs.gov/ntas/1.1/feed.xml',active:ntasCurrent?inputs.ntas.active.map(item=>pick(item,['type','start','end','locations','sectors','summary','url'])):null},
      roads:Array.isArray(roads)?roads.map(item=>pick(item,['id','agency','kind','name','detail','lat','lon','distanceKm','startAt','endAt','sourceRecordDate','sourceUrl'])):null,
      cameras:Array.isArray(cameras)?cameras.map(item=>pick(item,['id','agency','name','lat','lon','distanceKm','inService','operationalStatus','statusAsOf','metadataDate','sourceUrl','viewerUrl','stillUrl','videoUrl'])):null,
      policeAggregate:picture.policeContext,
      citywideNotices:picture.citywideAlertsContext,
      lanePermitPlanning:picture.phillyPermitContext,
      openRoadwayAggregate:picture.openRoadwayContext,
      stationAlerts:picture.transitContext,
      stationSchedule:picture.transitScheduleContext,
      stationPredictions:picture.transitPredictionsContext,
      septaBLineAlerts:picture.septaContext,
      njTransitEventRail:picture.njTransitRailContext,
      nj511EventRoad:picture.nj511Context
    },
    protectedPeople:{state:'not_collected_in_public_demo',reason:'Named-person material requires a documented protective nexus, controlled access, source review, and supervisor approval.'}
  };
}
