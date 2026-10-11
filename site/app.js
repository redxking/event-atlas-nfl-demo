import {selectNtas} from './national_source_context.js?v=national-integrity-1';
import {stopDemoTracking} from './demo_tracking.js?v=palette-2';
import {renderEventNotifications} from './event_notifications.js';
import {appendDemoOperationalFeeds,stopDemoReplay,getDemoReplaySnapshot} from './demo_operational_feeds.js?v=replay-report-1';
import {installBriefingGuide} from './briefing_guide.js?v=map-layers-1';
import {installEventWorkspaceTabs} from './event_workspace_tabs.js?v=event-notifications-1';
import {renderEventMonitoringPlan} from './event_monitoring_plan.js?v=event-monitoring-2';
import {stopPublicEventMonitor} from './public_event_monitor.js?v=event-monitoring-2';
import {getAdditionalSummary} from './event_catalog.js?v=event-monitoring-1';
import {eventTypeLabel,exampleSummary,renderAdditionalEvent} from './multi_event.js?v=map-key-1';
import {stopMovementTracking} from './movement_map.js?v=palette-2';
import {createThreatReportButton,refreshThreatReport} from './scope_threat_report.js?v=environment-integrity-1';
import {initializeWorkspaceViews,showWorkspaceView,setEventNavigation} from './workspace_views.js?v=multi-events-1';
import {renderDemoPeople} from './demo_people.js?v=no-download-1';
import {createGeographicExplorer} from './geographic_explorer.js?v=environment-integrity-1';
import {renderEventGeographicMap,renderEventConcerns} from './event_geographic_map.js?v=map-layers-1';
import {attentionSummary,humanLabel,humanText} from './attention_summary.js?v=coverage-1';
import {selectSofiContext,renderSofiContext} from './sofi_context.js';
import {selectRoadContext} from './road_relevance.js?v=expiry-1';
import {selectWeatherContext} from './weather_relevance.js?v=expiry-1';
import {summarizeCoverage} from './coverage_summary.js?v=20261010-9';
import {seattleCallQueries,summarizeSeattleCalls,seattleCallsLayer,seattleCallsViewer} from './public_safety_relevance.js?v=20261010-1';
import {arlingtonPoliceLayer,arlingtonAggregateQueries,summarizeArlingtonAggregate} from './arlington_police_aggregate.js?v=20261010-1';
import {buildNflEventPicture} from './nfl_event_picture.js?v=usgs-integrity-1';
import {buildNflEvidenceBundle} from './nfl_evidence_bundle.js?v=environment-integrity-1';
import {buildNflPublicReport} from './nfl_public_report.js?v=two-week-screening-1';
import {buildNflRelationshipLedger} from './nfl_relationship_ledger.js?v=20261010-1';
import {tfrAtKickoff} from './tfr_notam.js?v=20261009-1';
import {chicagoCrimeQuery,chicagoCrimeDataset,summarizeChicagoCrimes} from './chicago_public_safety.js?v=20261009-1';
import {indianapolisCfsLayer} from './indianapolis_public_safety.js';
import {glendaleCallsLayer,glendaleCallsViewer} from './glendale_public_calls.js?v=20261010-1';
import {charlotteIncidentsLayer} from './charlotte_public_safety.js';
import {denverCrimeLayer} from './denver_public_safety.js';
import {phillyCityAlertsUrl} from './philly_city_alerts.js';
import {phillyLanePermitLayer} from './philly_lane_permits.js';
import {cmpdOpenTrafficFeed,parseCmpdOpenTrafficXml,summarizeCmpdOpenTraffic} from './cmpd_open_traffic.js';
import {mbtaFoxboroAlertsUrl,summarizeMbtaFoxboroAlerts} from './mbta_foxboro_alerts.js?v=expiry-2';
import {mbtaFoxboroSchedulesUrl,summarizeMbtaFoxboroSchedules} from './mbta_foxboro_schedules.js';
import {mbtaFoxboroPredictionsUrl,summarizeMbtaFoxboroPredictions} from './mbta_foxboro_predictions.js';
import {publicRoadVideoAgency,advancingMedia} from './camera_video.js?v=camera-progress-1';
import {fl511EmbedUrl,fl511EmbedToolUrl} from './fl511_embed.js?v=20261010-2';
import {failedSourcesForVenue} from './venue_source_scope.js?v=20261010-1';
import {selectKickoffForecast,selectEventHourForecast} from './nws_forecast.js?v=20261010-1';
import {fetchNwsStationObservation} from './nws_observation.js?v=station-integrity-1';
import {selectSpcForGame} from './spc_outlook.js';
import {selectWpcRainForGame} from './wpc_rain_outlook.js';
import {selectUsgsForGame} from './usgs_nfl.js?v=usgs-integrity-1';
import {selectSeptaForGame,septaAlertsPage} from './septa_b_alerts.js?v=expiry-2';
import {selectNjTransitRailForGame,njTransitRailPage} from './njtransit_event_rail.js?v=20261010-2';
import {selectNj511ForGame,nj511EventsPage} from './nj511_events.js';
import {buildExerciseBrief,exerciseStages} from './demo_exercise.js';
import {selectNflNews} from './nfl_news_context.js?v=20261010-4';
import {shouldAdoptPublishedSnapshot,validPublishedSnapshotValue} from './published_snapshot_refresh.js?v=20261010-2';
import {seattleFireAggregateQuery,seattleFireMetadataUrl,seattleFireDataset,summarizeSeattleFireAggregate} from './seattle_fire_aggregate.js?v=20261010-2';
import {nashvillePoliceLayer,nashvillePolicePage,validateNashvillePoliceCount} from './nashville_police_aggregate.js?v=20261010-1';
import {diffEventPicture} from './event_picture_changes.js?v=20261010-41';
import {fetchSelectedGame} from './espn_game_summary.js?v=20261010-2';
import {parseTennesseeRoadEvents,tennesseeRoadLayer,tennesseeRoadQuery} from './tennessee_road_events.js?v=20261009-1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>new Date(value).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:'America/New_York'});
const gameTime=game=>game.timeTbd?new Date(game.kickoff).toLocaleDateString(undefined,{dateStyle:'medium',timeZone:'America/New_York'})+' · kickoff TBD':fmt(game.kickoff);
const gameStateText=game=>game.gameState?`${game.gameState.phase.toUpperCase()} · ${game.gameState.away.name} ${game.gameState.away.score}, ${game.gameState.home.name} ${game.gameState.home.score}${game.gameState.period?` · period ${game.gameState.period}${game.gameState.clock?` · ${game.gameState.clock}`:''}`:''}`:null;
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};
const cache=new Map(),changeHistory=new Map();let snapshot,eventExamples=[],cameraSnapshot,roadSnapshot,seamsSnapshot,tfrSnapshot,groundSnapshot,spcSnapshot,wpcRainSnapshot,eonetSnapshot,nifcSnapshot,airnowSnapshot,hmsSmokeSnapshot,greenBayAlertsSnapshot,lambeauPlanSnapshot,packersGameReleaseSnapshot,patriotsGamePreviewSnapshot,jetsGamedayGuideSnapshot,seahawksGamedaySnapshot,titansGamedaySnapshot,chiefsGameCenterSnapshot,ridekcArrowheadSnapshot,cardinalsLionsSnapshot,steelersColtsSnapshot,az511AlertsSnapshot,houstonTranstarSnapshot,houstonActiveIncidentsSnapshot,falconsGamedaySnapshot,commandersGamedaySnapshot,ramsBillsGamedaySnapshot,dolphinsCrucialCatchSnapshot,saintsGamedaySnapshot,nolaReadyEventSnapshot,nolaReadyActiveSnapshot,nolaReadyUpdatesSnapshot,nashvilleOemNewsSnapshot,nashvilleTitansClosuresSnapshot,wegoTitansAlertSnapshot,nolaReadyRegionalSnapshot,nortaAlertsSnapshot,nolaPublicCallsSnapshot,martaRailSnapshot,martaAlertPreviewSnapshot,georgiaTrafficSnapshot,soundTransitSeahawksSnapshot,soundTransitAlertsSnapshot,seattleFireAggregateSnapshot,seattleSpdBlotterSnapshot,nashvillePoliceCountSnapshot,publishedReports,newsSnapshot,gameArticlesSnapshot,directGame,ntasSnapshot,spaceWeatherSnapshot,septaSnapshot,njTransitRailSnapshot,indyPoliceSnapshot,glendalePoliceSnapshot,charlottePoliceSnapshot,denverPoliceSnapshot,phillyAlertsSnapshot,phillyPermitsSnapshot,nj511Snapshot,selected,cameraRefreshTimer,cameraPlayer,cameraFrame,hlsLoader,publicSafetyRefreshTimer,briefRefreshTimer,conditionsRefreshTimer,conditionsRequestSerial=0,conditionsPendingFor=null,briefConditions,briefForecast,briefPolice,cmpdTraffic,mbtaTransit,mbtaSchedule,mbtaPredictions,transitRefreshTimer,liveTennesseeRoad,tennesseeRoadRefreshTimer,directGameRefreshTimer,directGameRequestSerial=0,seattleFireRefreshTimer,seattleFireRequestSerial=0,lastSeattleFireDirectCheckAt=0,nashvillePoliceRefreshTimer,nashvillePoliceRequestSerial=0,lastNashvillePoliceDirectCheckAt=0,exerciseEnabled=false,exerciseStage=0,exercisePlaybackTimer,publicationRefreshPending=false,lastPublicationCheckAt=0;
async function json(url,timeoutMs=0){const local=new URL(url,location.href).origin===location.origin;const result=await fetch(url,{headers:{Accept:'application/geo+json, application/json'},cache:local?'no-store':'default',signal:timeoutMs?AbortSignal.timeout(timeoutMs):undefined});if(!result.ok)throw Error('HTTP '+result.status);return result.json()}
function sorted(games){const now=Date.now(),upcoming=$('time').value==='upcoming';return games.sort((a,b)=>{const at=Date.parse(a.kickoff),bt=Date.parse(b.kickoff);if(!upcoming)return at-bt;const aLive=a.status==='in progress in source',bLive=b.status==='in progress in source';if(aLive!==bLive)return aLive?-1:1;const af=at>=now,bf=bt>=now;return af!==bf?af?-1:1:af?at-bt:bt-at})}
function renderList(){refreshGameAttention();const q=$('search').value.trim().toLowerCase(),week=$('week').value;const items=sorted(snapshot.games.filter(game=>(!geographicVisibleIds||geographicVisibleIds.has(game.id))&&(!week||!game.week||String(game.week)===week)&&(!q||[game.title,game.venue.name,game.venue.address].some(value=>value.toLowerCase().includes(q)))));$('result-count').textContent=items.length+' events'+(selected&&!items.some(game=>game.id===selected)?' · Selected briefing is outside these filters':'');$('games').innerHTML=items.length?items.map(game=>`<button class="game ${game.id===selected?'selected':''}" aria-pressed="${game.id===selected}" data-id="${esc(game.id)}"><span class="game-top"><span>${esc(eventTypeLabel(game))}${game.week?' · Week '+game.week:''}</span><span class="date">${esc(gameTime(game))}</span></span><strong>${esc(game.title)}</strong><small>${esc(game.venue.name)} · ${esc(game.venue.address)}</small><span class="game-attention" data-attention-game="${esc(game.id)}">Assessment pending</span></button>`).join(''):'<p class="empty" style="padding:20px">No games match these filters.</p>';for(const button of $('games').querySelectorAll('.game'))button.onclick=()=>{selectGame(button.dataset.id);showWorkspaceView('event');const heading=$('detail').querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});if(matchMedia('(max-width:950px)').matches)heading.scrollIntoView({block:'start'})}}
function fact(label,value){return `<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`}
function link(url,label){try{const parsed=new URL(url);if(parsed.protocol!=='https:')return '';return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`}catch{return ''}}
function sharedRevisionHtml(group){
  return (group.revisions||[]).slice(0,8).map(revision=>{const event=(group.linkedEvents||[]).find(item=>item.eventId===revision.eventId),changes=revision.changedFields.map(field=>field==='magnitude'?`magnitude ${esc(revision.previous.magnitude)} → ${esc(revision.current.magnitude)}`:field==='title'?`title ${esc(revision.previous.title)} → ${esc(revision.current.title)}`:field==='occurredAt'?`occurrence time ${esc(fmt(revision.previous.occurredAt))} → ${esc(fmt(revision.current.occurredAt))}`:field==='acres'?`reported acres ${esc(revision.previous.acres??'unreported')} → ${esc(revision.current.acres??'unreported')}`:field==='containedPercent'?`reported containment ${esc(revision.previous.containedPercent??'unreported')}% → ${esc(revision.current.containedPercent??'unreported')}%`:`source point changed; candidate-point distance ${esc(revision.previous.distanceKm)} → ${esc(revision.current.distanceKm)} km`).join('; ');return `<span>Publisher revision for ${event?link(event.reportUrl,event.eventTitle):esc(revision.eventId)}${revision.provenance==='retained_prior_published_feed'?' (retained history)':''}: ${changes}. ${esc(group.sourceType)} update ${esc(fmt(revision.previous.sourceUpdatedAt))} → ${esc(fmt(revision.current.sourceUpdatedAt))}; first observed ${esc(fmt(revision.systemObservedAt))}. Unreviewed; verify the source and local effects.</span>`}).join('');
}
function sharedRegionalHtml(feed){
  const groups=Array.isArray(feed.sharedRegionalRecords)?feed.sharedRegionalRecords.slice(0,6):[];
  if(!groups.length)return '<h3>Shared regional records</h3><p>No source record currently appears in more than one eligible event-area sample. This is not an all-clear.</p>';
  return `<h3>Shared regional records · ${groups.length}</h3><p>Each group is one publisher record seen in multiple game-area samples, not independent corroboration. Distances use unreviewed venue points; event impact is not assessed.</p>${groups.map(group=>`<div class="brief-cue"><strong>${esc(group.title)}</strong><span>${esc(group.sourceType)}${group.occurredAt?' occurrence '+esc(fmt(group.occurredAt)):''}; source updated ${esc(fmt(group.updatedAt))}. ${esc(group.sourceIndependence.replaceAll('_',' '))}.</span>${(group.linkedEvents||[]).slice(0,8).map(event=>`<span>${link(event.reportUrl,event.eventTitle)} · ${esc(event.venueName)} · ${esc(event.distanceKm)} km · ${esc(event.windowRelation.replaceAll('_',' '))} · impact ${esc(event.possibleImpact)}</span>`).join('')}${sharedRevisionHtml(group)}${(group.linkedEvents?.length||0)>8||group.additionalLinkedEventCount?`<span>${esc(Math.max(0,(group.linkedEvents?.length||0)-8)+(group.additionalLinkedEventCount||0))} additional linked events in the feed JSON.</span>`:''}${group.excludedSample?`<span>Excluded sample: ${link(group.excludedSample.reportUrl,group.excludedSample.eventTitle)} · ${esc(group.excludedSample.distanceKm)} km; outside the ${esc(group.sourceType==='NIFC wildfire incident point'?'150':'250')} km display rule.</span>`:''}${link(group.sourceUrl,'One publisher record')}<span>${esc(group.limitations)}</span></div>`).join('')}`;
}
let publishedChangeFeed=null;
async function loadPublishedChanges(){
  const target=$('published-changes');
  try{
    const feed=await json('reports/changes.json',15000),age=Date.now()-Date.parse(feed.builtAt);
    if(feed.schema!=='event-atlas.published-change-feed.v1'||feed.status!=='unreviewed_public_source_changes'||!Array.isArray(feed.items)||feed.items.length>100||!Array.isArray(feed.sharedRegionalRecords)||feed.sharedRegionalRecords.length>6||!Number.isFinite(age)||age< -60000||age>12*3600000)throw Error('Change feed unavailable or stale');
    publishedChangeFeed=feed;refreshThreatReport();
    if(!target)return;
    const valid=feed.items.filter(item=>item.status==='unreviewed_source_change'&&typeof item.kind==='string'&&Number.isFinite(Date.parse(item.observedAt)));
    const substantive=valid.filter(item=>item.kind!=='source_status_changed');
    const selectedSubstantive=substantive.slice(0,3);
    const items=[...selectedSubstantive,...valid.filter(item=>item.kind==='source_status_changed').slice(0,5-selectedSubstantive.length)];
    target.innerHTML=`<p>Updated ${esc(fmt(feed.builtAt))}. Recent changes observed between bounded publisher snapshots; new records are shown before coverage status changes. Verify the source and game relevance. These are not confirmed incidents or threats.</p>${items.length?items.map(item=>`<div class="brief-cue"><strong>${esc(item.eventTitle)} · ${esc(humanText(item.title))}</strong><span>${esc(item.kind.replaceAll('_',' '))} · observed ${esc(fmt(item.observedAt))}</span>${link(item.reportUrl,'Game report')} · ${link(item.sourceUrl,'Publisher record')}${item.relatedSourceUrl?link(item.relatedSourceUrl,'Club plan'):''}</div>`).join(''):'<p>No comparable source change is recorded in the current bounded feed. This is not an all-clear.</p>'}<p><a href="reports/changes.xml">Subscribe to Atom changes ↗</a></p>${sharedRegionalHtml(feed)}`;
  }catch{publishedChangeFeed={status:'unavailable'};refreshThreatReport();if(target)target.innerHTML='<p>Published change feed is unavailable or stale. Check the event reports and publisher sources directly.</p>'}
}
const sofiSources={};
let sofiSourcesPending=false,lastSofiSourcesCheck=0;
async function loadSofiSources(){
  if(sofiSourcesPending||Date.now()-lastSofiSourcesCheck<300000)return;
  sofiSourcesPending=true;
  const files={chargersThemes:'chargers_themes.json',metroSofiPlan:'metro_sofi_plan.json',metroI105Notice:'metro_i105_notice.json',sofiEventPages:'sofi_event_pages.json',inglewoodAlerts:'inglewood_alerts.json'};
  try{
    const entries=Object.entries(files),results=await Promise.allSettled(entries.map(([,file])=>json(file,15000)));
    results.forEach((result,index)=>{sofiSources[entries[index][0]]=result.status==='fulfilled'?result.value:null});
    lastSofiSourcesCheck=Date.now();
    const game=snapshot?.games.find(item=>item.id===selected);
    if(game)renderBrief(game);
  }finally{sofiSourcesPending=false}
}
const selectedRoadSnapshot=game=>game?.venue.id==='3810'&&liveTennesseeRoad?.state==='ok'&&Date.now()-liveTennesseeRoad.checkedAt<=15*60000?liveTennesseeRoad.snapshot:roadSnapshot;
const briefInputs=()=>({...sofiSources,schedule:snapshot,ground:groundSnapshot,airspace:seamsSnapshot,tfr:tfrSnapshot,cameras:cameraSnapshot,roads:selectedRoadSnapshot(snapshot?.games.find(game=>game.id===selected)),spc:spcSnapshot,wpcRain:wpcRainSnapshot,eonet:eonetSnapshot,nifc:nifcSnapshot,airnow:airnowSnapshot,hmsSmoke:hmsSmokeSnapshot,greenBayAlerts:greenBayAlertsSnapshot,lambeauPlan:lambeauPlanSnapshot,packersGameRelease:packersGameReleaseSnapshot,patriotsGamePreview:patriotsGamePreviewSnapshot,jetsGamedayGuide:jetsGamedayGuideSnapshot,seahawksGameday:seahawksGamedaySnapshot,titansGameday:titansGamedaySnapshot,chiefsGameCenter:chiefsGameCenterSnapshot,ridekcArrowhead:ridekcArrowheadSnapshot,cardinalsLionsBroadcast:cardinalsLionsSnapshot,steelersColtsBroadcast:steelersColtsSnapshot,az511PublicAlerts:az511AlertsSnapshot,houstonTranstarRss:houstonTranstarSnapshot,houstonActiveIncidents:houstonActiveIncidentsSnapshot,falconsGameday:falconsGamedaySnapshot,commandersGameday:commandersGamedaySnapshot,ramsBillsGameday:ramsBillsGamedaySnapshot,dolphinsCrucialCatch:dolphinsCrucialCatchSnapshot,saintsGameday:saintsGamedaySnapshot,nolaReadyEvent:nolaReadyEventSnapshot,nolaReadyActive:nolaReadyActiveSnapshot,nolaReadyUpdates:nolaReadyUpdatesSnapshot,nashvilleOemNews:nashvilleOemNewsSnapshot,nashvilleTitansClosures:nashvilleTitansClosuresSnapshot,wegoTitansAlert:wegoTitansAlertSnapshot,nolaReadyRegional:nolaReadyRegionalSnapshot,nortaAlerts:nortaAlertsSnapshot,nolaPublicCalls:nolaPublicCallsSnapshot,martaRail:martaRailSnapshot,martaAlertPreview:martaAlertPreviewSnapshot,georgiaTraffic:georgiaTrafficSnapshot,soundTransitSeahawks:soundTransitSeahawksSnapshot,soundTransitAlerts:soundTransitAlertsSnapshot,seattleFireAggregate:seattleFireAggregateSnapshot,seattleSpdBlotter:seattleSpdBlotterSnapshot,nashvillePoliceCount:nashvillePoliceCountSnapshot,news:newsSnapshot,gameArticles:gameArticlesSnapshot,directGame,roadDirect:liveTennesseeRoad,conditions:briefConditions,forecast:briefForecast,police:briefPolice,phillyAlerts:phillyAlertsSnapshot,phillyPermits:phillyPermitsSnapshot,cmpdTraffic,transit:mbtaTransit,transitSchedule:mbtaSchedule,transitPredictions:mbtaPredictions,septa:septaSnapshot,njTransitRail:njTransitRailSnapshot,nj511:nj511Snapshot,ntas:ntasSnapshot,spaceWeather:spaceWeatherSnapshot});
function downloadEvidenceBundle(game){
  if(selected!==game.id)return;
  const bundle=buildNflEvidenceBundle(game,briefInputs());
  bundle.clientObservedChanges={state:'in_memory_since_page_open',items:changeHistory.get(game.id)?.items||[],interpretation:'These are changes observed by this browser session in bounded source samples. They are not a complete publisher history, a threat finding, or evidence that a missing item resolved.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)+'\n'],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`event-atlas-${game.id.replace(/[^A-Za-z0-9_-]/g,'-')}-public-evidence.json`;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function downloadPublicReport(game){
  if(selected!==game.id)return;
  const report=buildNflPublicReport(buildNflEvidenceBundle(game,briefInputs()));
  const url=URL.createObjectURL(new Blob([report],{type:'text/markdown;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`event-atlas-${game.id.replace(/[^A-Za-z0-9_-]/g,'-')}-public-source-report.md`;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function downloadExerciseBundle(game){
  if(selected!==game.id||!exerciseEnabled)return;
  const bundle={kind:'simulated_training_exercise',venue:{id:game.venue.id,name:game.venue.name},event:{id:game.id,title:game.title},exercise:buildExerciseBrief(exerciseStage),notice:'Every observation and correlation is fictional. No live source or AI model produced this exercise brief.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)+'\n'],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`event-atlas-${game.id.replace(/[^A-Za-z0-9_-]/g,'-')}-simulated-exercise.json`;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function renderSpc(game){
  const target=$('spc');if(!target||!game)return;
  const result=selectSpcForGame(game,spcSnapshot);
  target.innerHTML=`<p class="feed-state">NOAA SPC DAY 1–3 OUTLOOK · ${esc(humanLabel(result.state))}</p>`+
    (result.match?`<p><strong>${esc(result.match.category)} categorical forecast</strong> at the unreviewed stadium point for the listed kickoff. Day ${esc(result.match.day)} · issued ${esc(fmt(result.match.issuedAt))} · valid ${esc(fmt(result.match.validAt))} to ${esc(fmt(result.match.expiresAt))}. ${link(result.match.sourceUrl,'NOAA SPC source')}</p>`:
      `<p>${result.state==='stale or unavailable'?'Current SPC outlook snapshot unavailable.':result.state==='not screenable'?'The listed kickoff cannot be screened against a current Day 1–3 outlook.':result.state==='outside published Day 1–3 window'?'Kickoff is outside the published forecast validity windows.':'No categorical polygon covered the candidate point at the listed kickoff in this snapshot.'} ${link(result.sourceUrl,'NOAA SPC source')}</p>`)+
    '<p>Regional forecast context only. Confirm the current NOAA outlook and NWS alerts; no point match does not establish safety, and a forecast category is not a venue impact or threat assessment.</p>';
}
function renderWpcRain(game){
  const target=$('wpc-rain');if(!target||!game)return;
  const result=selectWpcRainForGame(game,wpcRainSnapshot);
  target.innerHTML=`<p class="feed-state">NOAA WPC DAY 1–3 EXCESSIVE-RAINFALL OUTLOOK · ${esc(humanLabel(result.state))}</p>`+
    (result.match?`<p><strong>${esc(result.match.category)} excessive-rainfall forecast</strong> at the unreviewed stadium point for the listed kickoff. Day ${esc(result.match.day)} · issued ${esc(fmt(result.match.issuedAt))} · valid ${esc(fmt(result.match.validAt))} to ${esc(fmt(result.match.expiresAt))}. ${link(result.match.sourceUrl,'NOAA WPC source')}</p>`:
      `<p>${result.state==='stale or unavailable'?'Current WPC outlook snapshot unavailable.':result.state==='not screenable'?'The listed kickoff cannot be screened against a current Day 1–3 outlook.':result.state==='outside published Day 1–3 window'?'Kickoff is outside the published forecast validity windows.':'No excessive-rainfall polygon covered the candidate point at the listed kickoff in this snapshot.'} ${link(result.sourceUrl,'NOAA WPC source')}</p>`)+
    '<p>Regional flash-flood planning context only. Confirm the current NOAA outlook and NWS alerts; no point match does not establish safety, and a forecast category is not a flood warning, route impact, or threat assessment.</p>';
}
function renderBrief(game){
  const target=$('event-picture');
  if(!target||!game||game.eventType&&game.eventType!=='nfl')return;
  const inputs=briefInputs();
  const picture=buildNflEventPicture(game,inputs);
  renderAttention(game,picture);renderPeopleProtection(picture);refreshGameAttention();
  const news=selectNflNews(game,newsSnapshot);
  const ledger=buildNflRelationshipLedger(game,picture,{news,roads:inputs.roads?.byVenue?.[game.venue.id]});
  const gameArticle=picture.gameArticle;
  const direct=picture.directGame;
  const natural=picture.naturalEventsContext;
  const wildfire=picture.wildfireContext,air=picture.airQualityContext,smoke=picture.smokeContext;
  const prior=changeHistory.get(game.id);
  const currentGame={kickoff:game.kickoff,status:game.status,timeTbd:game.timeTbd,gameState:game.gameState,sourceRetrievedAt:game.sourceRetrievedAt,sourceUrl:game.sourceUrl};
  const observed=prior?diffEventPicture(prior.picture,picture,prior.news,news,prior.game,currentGame):[];
  const updates=[...observed.reverse(),...(prior?.items||[])].slice(0,24);
  changeHistory.set(game.id,{picture,news,game:currentGame,items:updates});
  const published=publishedReports?.reports?.find(item=>item.eventId===game.id&&item.path===`reports/${game.id.replace(':','-')}.html`);
  const publishedLink=published?`<p class="bundle-note">${published.monitoringMode==='season_planning'?'Season planning report':'Near-term monitoring report'} generated ${esc(fmt(published.generatedAt))}; NWS alerts ${esc(humanLabel(published.nwsAlerts))}, hourly forecast ${esc(humanLabel(published.nwsForecast))}; ${Number.isSafeInteger(published.newPublishedChanges)?esc(published.newPublishedChanges)+' new bounded source change'+(published.newPublishedChanges===1?'':'s')+' since the prior comparable report; ':''}${published.monitoringMode==='season_planning'?'point alert and forecast checks begin within fourteen days of the game.':'review the change trail in the report.'} This is a point-in-time, unreviewed report and may be older than the browser checks. <a href="${esc(published.path)}" target="_blank" rel="noopener noreferrer">Open published source-linked report ↗</a></p>`:'';
  const total=picture.cueCounts.weather+(picture.cueCounts.outlook||0)+(picture.cueCounts.rainfall||0)+picture.cueCounts.road+picture.cueCounts.transit;
  target.innerHTML=`<p class="feed-state">PUBLIC-SOURCE EVENT PICTURE · GENERATED ${esc(fmt(picture.generatedAt))}</p><p><strong>Assessment: severity and confidence not assessed.</strong> ${picture.cueCounts.weather} NWS alert review candidate${picture.cueCounts.weather===1?'':'s'}; ${picture.cueCounts.outlook||0} SPC forecast review candidate${picture.cueCounts.outlook===1?'':'s'}; ${picture.cueCounts.rainfall||0} WPC rainfall forecast review candidate${picture.cueCounts.rainfall===1?'':'s'}; ${picture.cueCounts.road} published roadway time overlap${picture.cueCounts.road===1?'':'s'}; ${picture.cueCounts.transit} transit alert time overlap${picture.cueCounts.transit===1?'':'s'}. ${esc(picture.interpretation)}</p>`+
    `<details class="brief-details"><summary>Why records appear · ${ledger.items.length} source links and exclusions</summary><p>Exact game ${ledger.counts.direct_event_record}; time-and-place candidates ${ledger.counts.time_place_candidate}; regional context ${ledger.counts.regional_context}; disputed ${ledger.counts.contradictory_record}; excluded sample ${ledger.counts.excluded_link}; coverage gaps ${ledger.coverageGapCount}. Screening uses the listed kickoff and an illustrative window. A nearby record is not a verified event effect.</p>${ledger.items.map(item=>`<div class="brief-cue"><strong>${esc(humanLabel(item.relationship))} · ${esc(item.claim)}</strong><span>${esc(humanText(item.basis))} Relevance: ${esc(item.pathway)}. ${item.sourceTime?`Source time ${esc(fmt(item.sourceTime))} (${esc(item.sourceTimeBasis)}). `:''}Disposition ${esc(humanLabel(item.disposition))}; impact ${esc(humanLabel(item.possibleImpact))}. ${item.duplicateCueCount>1?`${item.duplicateCueCount} duplicate displayed cues grouped, not independent corroboration. `:''}Alternative: ${esc(item.alternative)}</span>${link(item.sourceUrl,'Publisher record')}${item.relatedSourceUrl?link(item.relatedSourceUrl,'Related plan'):''}</div>`).join('')}<p>${esc(ledger.limitations)}</p></details>`+

    (game.venue.id==='3970'?`<details class="brief-details"><summary>AZ511 regional public alerts · ${esc(humanLabel(picture.az511AlertContext.state))}</summary><p>Public page checked ${esc(fmt(picture.az511AlertContext.asOf))}; ${esc(picture.az511AlertContext.totalListed)} alert(s) listed statewide.</p>${picture.az511AlertContext.entries.map(item=>`<div class="brief-cue"><strong>${esc(humanText(item.title))}</strong><span>Publisher update ${esc(fmt(item.updatedAt))}; notice date range ${esc(item.localDateStart)} to ${esc(item.localDateEnd)}. ${esc(item.notes.slice(0,700))}</span>${link(item.sourceUrl,'AZ511 public alert')}</div>`).join('')}<p>A date-matched regional notice does not verify precise closure time, an event travel route, current road status, venue impact, or threat. Confirm with ADOT and current AZ511 conditions.</p></details>`:'')+
    (game.venue.id==='3891'?`<details class="brief-details"><summary>Houston TranStar corridor RSS · ${esc(humanLabel(picture.houstonTranstarContext.state))}</summary><p>Checked ${esc(fmt(picture.houstonTranstarContext.asOf))}. ${picture.houstonTranstarContext.feeds.map(feed=>`${esc(feed.kind.replaceAll('_',' '))}: ${esc(humanLabel(feed.state))}, ${esc(feed.corridorListed??'unavailable')} corridor text matches among ${esc(feed.totalListed??'unavailable')} feed items`).join('; ')}.</p>${picture.houstonTranstarContext.entries.slice(0,10).map(item=>`<div class="brief-cue"><strong>${esc(item.kind.replaceAll('_',' '))} · ${esc(humanText(item.title))}</strong><span>${esc(item.description)} · feed published ${esc(fmt(item.sourceAt))}</span>${link(item.sourceUrl,'Houston TranStar RSS')}</div>`).join('')}<p>IH-610 South Loop/SH-288 text matches are regional context, not geocoded proximity, a verified event route, conditions at kickoff, or a stadium threat. Cleared and inactive items are retained with publisher status. ${link(picture.houstonTranstarContext.sourceUrl,'Publisher RSS directory')}</p></details>`:'')+
    (game.id==='nfl:401872991'?`<details class="brief-details"><summary>Cardinals–Lions official article · ${esc(humanLabel(picture.cardinalsContext.state))}</summary><p>Official club article published ${esc(fmt(picture.cardinalsContext.publishedAt))}; checked ${esc(fmt(picture.cardinalsContext.asOf))}.</p>${picture.cardinalsContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.id.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Cardinals article')}</div>`).join('')}<p>Broadcast assignments are publisher claims, not proof of physical presence, protected status, or a threat.</p></details>`:'')+
    (game.id==='nfl:401872985'?`<details class="brief-details"><summary>Steelers–Colts official article · ${esc(humanLabel(picture.steelersContext.state))}</summary><p>Official club article published ${esc(fmt(picture.steelersContext.publishedAt))}; checked ${esc(fmt(picture.steelersContext.asOf))}.</p>${picture.steelersContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.id.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Steelers article')}</div>`).join('')}<p>Broadcast assignments are publisher claims, not proof of physical presence, protected status, or a threat.</p></details>`:'')+
    `<details class="brief-details"><summary>Changes observed since this page opened · ${updates.length}</summary>${updates.length?updates.map(item=>`<div class="brief-cue"><strong>${esc(humanText(item.title))}</strong><span>${esc(item.kind.replaceAll('_',' '))} · noticed ${esc(fmt(item.observedAt))} · ${esc(humanText(item.detail))}</span>${link(item.sourceUrl,'Publisher source')}</div>`).join(''):'<p>No source-status transition or newly displayed cue has been observed in this browser session. This does not establish that conditions are unchanged or safe.</p>'}<p>This is an in-memory comparison of bounded displayed samples, not a complete change history. A disappearing item is not treated as resolved.</p></details>`+
    `<details class="brief-details"><summary>Analyst verification queue · ${picture.reviewQueue?.items?.length||0}</summary>${picture.reviewQueue?.items?.length?picture.reviewQueue.items.map(item=>`<div class="brief-cue"><strong>${esc(item.domain.toUpperCase())} · ${esc(item.trigger)}</strong><span>${esc(item.action)} Source basis: ${esc(humanText(item.basis))} · ${esc(humanLabel(item.phase))}${item.sourceAt?' · source time '+esc(fmt(item.sourceAt)):''}</span>${link(item.sourceUrl,'Publisher record')}${item.relatedSourceUrl?link(item.relatedSourceUrl,'Club plan'):''}</div>`).join(''):'<p>No time-screened source cue is queued; inspect source status and gaps. This is not an all-clear.</p>'}<p>${esc(picture.reviewQueue?.note||'Queue unavailable.')}</p></details>`+
    `<details class="brief-details"><summary>NASA regional natural events · ${natural.state==='current_snapshot'?natural.events.length+' point candidate'+(natural.events.length===1?'':'s'):esc(humanLabel(natural.state))}</summary>${natural.state==='current_snapshot'&&natural.events.length?natural.events.map(item=>`<div class="brief-cue"><strong>${esc(humanText(item.title))}</strong><span>${esc(item.categories.join(', ')||'Category unavailable')} · ${esc(item.distanceKm)} km from candidate venue point · NASA geometry date ${esc(fmt(item.sourceAt))}</span>${link(item.sourceUrl,'NASA event record')}</div>`).join(''):`<p>${natural.state==='not_started'?'Current natural-event points are not screened as event context outside the near-term monitoring window.':'No recent open-event point is listed within 250 km in the current bounded snapshot, or the source is unavailable. This is not an all-clear.'}</p>`}<p>NASA EONET open-event points are regional context. The 500-event query, curation cadence and point-only screen are incomplete; a listing is not a current local incident, forecast, event impact, or threat. ${link(natural.sourceUrl,'NASA EONET source')}</p></details>`+
    `<details class="brief-details"><summary>Wildfire, smoke and air-quality observations · ${wildfire.events.length} fire points · ${smoke.polygons.length} smoke polygons</summary><p><strong>NIFC wildfire points:</strong> ${esc(humanLabel(wildfire.state))}${wildfire.asOf?' · snapshot '+esc(fmt(wildfire.asOf)):''}. ${link(wildfire.sourceUrl,'NIFC source')}</p>${wildfire.events.map(item=>`<div class="brief-cue"><strong>${esc(item.name)}</strong><span>${esc(item.distanceKm)} km from candidate venue point · source updated ${esc(fmt(item.updatedAt))}</span>${link(item.sourceUrl,'NIFC incident')}</div>`).join('')}<p><strong>NOAA satellite smoke:</strong> ${esc(humanLabel(smoke.state))}${smoke.analysisDate?' · analysis '+esc(smoke.analysisDate):''}. ${link(smoke.sourceUrl,'NOAA KML')}</p>${smoke.polygons.map(item=>`<div class="brief-cue"><strong>${esc(item.density)} source density polygon</strong><span>Candidate venue point inside dated satellite polygon · ${esc(fmt(item.startAt))} to ${esc(fmt(item.endAt))}</span>${link(item.sourceUrl,'NOAA daily file')}</div>`).join('')}<p><strong>EPA nearby PM2.5:</strong> ${esc(humanLabel(air.state))}${air.observation?' · station '+esc(air.observation.stationId)+' · '+esc(air.observation.pm25UgM3)+' µg/m³ · '+esc(air.observation.distanceKm)+' km away · measured '+esc(fmt(air.observation.observedAt)):''}. ${link(air.sourceUrl,'EPA source query')}</p><p><strong>Source time comparison:</strong> ${esc(picture.environmentalCorrelation.summary)} ${link(picture.environmentalCorrelation.smokeSourceUrl,'NOAA analysis')} ${link(picture.environmentalCorrelation.airSourceUrl,'EPA observation')} ${link(picture.environmentalCorrelation.wildfireSourceUrl,'NIFC source')}</p><p>These sources have different locations and times. A fire point or satellite polygon does not establish ground exposure, its source fire, or event impact. The station reading is preliminary and is not measured inside the stadium.</p></details>`+
    (game.venue.id==='3798'?`<details class="brief-details"><summary>Green Bay city emergency and police notices · ${esc(humanLabel(picture.greenBayAlertContext.state))} · ${picture.greenBayAlertContext.alerts.length} listed</summary>${picture.greenBayAlertContext.sources.map(item=>`<p>${esc(item.kind)} RSS: ${esc(humanLabel(item.state))} · source build ${esc(fmt(item.sourceBuiltAt))}${item.publisherClockAhead?' · publisher timestamp after retrieval; possible clock or timezone error':''}. ${link(item.sourceUrl,'City RSS')}</p>`).join('')}${picture.greenBayAlertContext.alerts.map(item=>`<div class="brief-cue"><strong>${esc(item.kind)} · ${esc(humanText(item.title))}</strong><span>${esc(humanText(item.detail))}${item.publishedAt?' · published '+esc(fmt(item.publishedAt)):''}</span>${link(item.url,'City notice')}</div>`).join('')}<p>These city website categories have no incident geometry and do not cover every emergency or police event. An empty active list is not an all-clear; a listed notice does not establish stadium impact or a threat. ${link(picture.greenBayAlertContext.sourceUrl,'City alert center')}</p></details>`:'')+
    (game.venue.id==='3798'?`<details class="brief-details"><summary>Lambeau published game-day plan · ${esc(humanLabel(picture.lambeauPlanContext.state))}</summary><p>Checked ${esc(fmt(picture.lambeauPlanContext.asOf))}. ${link(picture.lambeauPlanContext.sourceUrl,'Packers venue page')}</p>${picture.lambeauPlanContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.topic)}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Venue plan')}</div>`).join('')}${picture.lambeauPlanContext.derivedTimes?`<p>From the listed kickoff: gates ${esc(fmt(picture.lambeauPlanContext.derivedTimes.gatesOpenAt))}; Oneida closure and bus service ${esc(fmt(picture.lambeauPlanContext.derivedTimes.oneidaClosureStartAt))}. Calculated planning times only.</p>`:''}<p>This is a general venue-published home-game plan, not observed traffic control or a confirmed bus run. Verify with the venue, road authority and transit agency before using it operationally.</p></details>`:'')+
    (game.id==='nfl:401872990'?`<details class="brief-details"><summary>Packers–Bears announced people and production · ${esc(humanLabel(picture.packersReleaseContext.state))}</summary><p>Official club articles checked ${esc(fmt(picture.packersReleaseContext.asOf))}. Named people and activities are announced plans; attendance and execution have not been verified.</p>${picture.packersReleaseContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.category.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Packers article')}</div>`).join('')}<p>A published appearance is not a protected-person designation or threat. Confirm current plans with the club; coordinate any aviation interpretation with responsible authorities.</p></details>`:'')+
    (game.id==='nfl:401872986'?`<details class="brief-details"><summary>Patriots–Raiders club announcements · ${esc(humanLabel(picture.patriotsPreviewContext.state))}</summary><p>Official Patriots preview checked ${esc(fmt(picture.patriotsPreviewContext.asOf))}; published ${esc(fmt(picture.patriotsPreviewContext.publishedAt))}. Ceremony and production plans are announced, not verified attendance or execution.</p>${picture.patriotsPreviewContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.category.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Patriots preview')}</div>`).join('')}<p>A named honoree is not a verified attendee, protected person, or threat finding. Confirm current plans with the club.</p></details>`:'')+
    (game.id==='nfl:401872983'?`<details class="brief-details"><summary>Jets–Browns game-day guide · ${esc(humanLabel(picture.jetsGuideContext.state))}</summary><p>Official Jets guide checked ${esc(fmt(picture.jetsGuideContext.asOf))}; publisher publication time unavailable. Parking, entry, anthem, tailgate, and giveaway details are published plans or recommendations.</p>${picture.jetsGuideContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.category.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Jets guide')}</div>`).join('')}<p>Venue operations and named-person attendance are unverified. Confirm current details with the club and operators.</p></details>`:'')+
    (game.venue.id==='3810'?`<details class="brief-details"><summary>Nashville Police citywide active major calls · ${esc(humanLabel(picture.nashvillePoliceContext.state))}</summary>${picture.nashvillePoliceContext.state==='current_citywide_count'?`<p>${esc(picture.nashvillePoliceContext.activeCount)} active major calls across Metro Nashville at source update ${esc(fmt(picture.nashvillePoliceContext.sourceUpdatedAt))}; checked ${esc(fmt(picture.nashvillePoliceContext.checkedAt))}.</p>`:'<p>Current citywide count unavailable; no count or negative finding can be inferred.</p>'}<p>Count only. No call locations, types, IDs, or people are requested or retained. Citywide scope does not establish a call near Nissan Stadium, event impact, or a threat. ${link(picture.nashvillePoliceContext.agencyPageUrl,'Metro Nashville Police source')}</p></details>`:'')+
    (game.id==='nfl:401872993'?`<details class="brief-details"><summary>Georgia DOT Fulton traffic table · ${esc(humanLabel(picture.georgiaTrafficContext.state))}</summary><p>Official table ${picture.georgiaTrafficContext.asOf?'retrieved '+esc(fmt(picture.georgiaTrafficContext.asOf)):'unavailable'}; ${picture.georgiaTrafficContext.state==='current_retrieval_time_basis_unverified'?esc(picture.georgiaTrafficContext.recentCountyCount)+' recently displayed Fulton rows; '+esc(picture.georgiaTrafficContext.olderOmittedCount)+' older rows omitted':'current county rows cannot be screened'}.</p>${picture.georgiaTrafficContext.records.map(item=>`<div class="brief-cue"><strong>${esc(item.id)} · ${esc(item.category)}</strong><span>${esc(item.road)} near ${esc(item.crossRoad)} · ${esc(humanText(item.detail))} · publisher status ${esc(item.publisherStatus)} · displayed update ${esc(item.publisherDisplayedUpdated)} (time zone unverified)</span>${link(item.sourceUrl,'Georgia DOT table')}</div>`).join('')}<p>County scope and publisher-displayed wall times do not establish stadium proximity, active road conditions, kickoff overlap, or a threat.</p></details>`:'')+
    (game.id==='nfl:401872993'?`<details class="brief-details"><summary>MARTA Train Alerts preview · ${esc(humanLabel(picture.martaAlertContext.state))}</summary><p>Official homepage preview ${picture.martaAlertContext.asOf?'retrieved '+esc(fmt(picture.martaAlertContext.asOf)):'unavailable'}; ${picture.martaAlertContext.state==='current_preview'?esc(picture.martaAlertContext.listedCount)+' source-listed train alerts; '+esc(picture.martaAlertContext.windowCandidateCount)+' unexpired notices have an expiry after the illustrative event-window start.':'current notice counts cannot be screened.'}</p>${picture.martaAlertContext.alerts.filter(item=>item.activeAtView).map(item=>`<div class="brief-cue"><strong>MARTA notice</strong><span>${esc(humanText(item.detail))} · expires ${esc(fmt(item.expiresAt))} · expiry ${item.expiryExtendsIntoEventWindow?'extends into':'precedes'} illustrative event window</span>${link(item.sourceUrl,'MARTA alerts')}</div>`).join('')}<p>Limited homepage preview; no publisher start time, station impact, stadium effect, or negative finding follows. ${link(picture.martaAlertContext.sourceUrl,'MARTA homepage')}</p></details>`:'')+
    (game.id==='nfl:401872993'?`<details class="brief-details"><summary>MARTA October 11 rail schedule · ${esc(humanLabel(picture.martaRailContext.state))}</summary><p>Official MARTA regional schedule checked ${esc(fmt(picture.martaRailContext.asOf))}; publisher publication time unavailable.</p>${picture.martaRailContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.line)} Line</strong><span>${esc(item.summary)} Destination: ${esc(item.destination)}</span>${link(item.sourceUrl,'MARTA schedule')}</div>`).join('')}<p>Published frequencies are not real-time arrivals, verified train operation, station conditions or stadium impact.</p></details>`:'')+
    (game.id==='nfl:401872987'?`<details class="brief-details"><summary>Saints pregame and DOTD road windows · ${esc(humanLabel(picture.saintsAccessComparison.state))}</summary><p>Champions Square planned window: ${picture.saintsAccessComparison.plannedWindow?`${esc(fmt(picture.saintsAccessComparison.plannedWindow.startAt))} to ${esc(fmt(picture.saintsAccessComparison.plannedWindow.endAt))}`:'unavailable'}. ${picture.saintsAccessComparison.matches.length} bounded DOTD road windows overlap that club plan.</p>${picture.saintsAccessComparison.matches.map(item=>`<div class="brief-cue"><strong>${esc(item.name)} · ${esc(item.distanceKm)} km from candidate point</strong><span>DOTD published window ${esc(fmt(item.startAt))} to ${esc(fmt(item.endAt))}. Route and actual impact unverified.</span>${link(item.sourceUrl,'DOTD record')}${link(picture.saintsAccessComparison.clubSourceUrl,'Saints plan')}</div>`).join('')}<p>Time and distance overlap require road agency and venue transport verification. No attendee-route or stadium impact is established.</p></details>`:'')+
    (game.venue.id==='3493'?`<details class="brief-details"><summary>NOPD/OPCD public call aggregate · ${esc(humanLabel(picture.nolaCallsContext.state))}</summary><p>${picture.nolaCallsContext.state==='provisional_delayed_historical'?`${esc(picture.nolaCallsContext.nearbyCount)} mapped public calls within 2 km of the unreviewed venue point on selected wall-date ${esc(picture.nolaCallsContext.periodStart)}.`:'Current count unavailable.'} ${link(picture.nolaCallsContext.sourceUrl,'Data.NOLA source')}</p><p>Preliminary and delayed. Some sensitive call types lack public coordinates. No incident records, addresses, categories or identities are retained. This is not an active police alert, stadium incident, trend, threat indicator or risk score.</p></details>`:'')+
    (game.venue.id==='3493'?`<details class="brief-details"><summary>New Orleans RTA service alerts · ${esc(humanLabel(picture.nortaAlertContext.state))}</summary><p>Publisher-listed notices: ${esc(picture.nortaAlertContext.listedCount??'unavailable')}; dated in the past three calendar days: ${esc(picture.nortaAlertContext.recentCount??'unavailable')}; notices naming a Superdome-area place: ${esc(picture.nortaAlertContext.venueTextCandidates.length)}.</p>${picture.nortaAlertContext.venueTextCandidates.map(item=>`<div class="brief-cue"><strong>${esc(item.routeId)} ${esc(item.routeName)} · ${esc(humanText(item.title))}</strong><span>${esc(humanText(item.detail))} · publisher AS OF ${esc(item.asOfText)} (time zone unverified)</span>${link(item.sourceUrl,'RTA alert page')}</div>`).join('')}<p>Older notices remain listed. A recent listing or place-name match does not verify active service, route geometry, event-window overlap or stadium impact. ${link(picture.nortaAlertContext.sourceUrl,'Check RTA directly')}</p></details>`:'')+
    (game.id==='nfl:401872987'?`<details class="brief-details"><summary>Saints–Vikings game-day guide · ${esc(humanLabel(picture.saintsGuideContext.state))}</summary><p>Official Saints guide checked ${esc(fmt(picture.saintsGuideContext.asOf))}; publisher lists Oct. 9, 2026 at 10:01 AM without a verified time zone. Champions Square, stage performance, anthem, halftime ceremony, and Legend of the Game are published plans.</p>${picture.saintsGuideContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.id.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Saints guide')}</div>`).join('')}<p>Actual operations, ceremonies, attendance and protective status are unverified.</p></details>`:'')+
    (game.id==='nfl:401872994'?`<details class="brief-details"><summary>Rams–Bills exact-game guide · ${esc(humanLabel(picture.ramsBillsGuideContext.state))}</summary><p>Official Rams guide checked ${esc(fmt(picture.ramsBillsGuideContext.asOf))}; publication text ${esc(picture.ramsBillsGuideContext.sourcePublicationText||'unavailable')}.</p>${picture.ramsBillsGuideContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.id.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Rams guide')}</div>`).join('')}<p>Published program and activity windows only. Individual attendance and execution are unverified. NFL Votes is voter registration, not a polling place.</p></details>`:'')+
    (game.id==='nfl:401872988'?`<details class="brief-details"><summary>Commanders–Giants game-day guide · ${esc(humanLabel(picture.commandersGuideContext.state))}</summary><p>Official Commanders guide checked ${esc(fmt(picture.commandersGuideContext.asOf))}; publisher publication time unavailable. Times are eastern.</p>${picture.commandersGuideContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.category.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Commanders guide')}</div>`).join('')}<p>Published parking, rideshare, plaza, gate, ceremony and appearance plans are not observed operations or verified attendance.</p></details>`:'')+
    (game.id==='nfl:401872993'?`<details class="brief-details"><summary>Falcons–Ravens game-day guide · ${esc(humanLabel(picture.falconsGuideContext.state))}</summary><p>Official Falcons guide checked ${esc(fmt(picture.falconsGuideContext.asOf))}; publisher publication time unavailable. Roof, parking, gate, ceremony and named appearances are published plans.</p>${picture.falconsGuideContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.id.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Falcons guide')}</div>`).join('')}<p>Appearances are subject to change. Actual venue conditions, attendance and protective status are unverified.</p></details>`:'')+
    (game.id==='nfl:401873006'?`<details class="brief-details"><summary>RideKC nearby transit timetable · ${esc(humanLabel(picture.ridekcContext.state))}</summary><p>Official static GTFS checked ${esc(fmt(picture.ridekcContext.asOf))}; feed version ${esc(picture.ridekcContext.feedVersion||'unavailable')}. Bounded scheduled-call window: ${esc(picture.ridekcContext.windowLocal||'unavailable')} Central.</p>${picture.ridekcContext.routes.map(route=>`<div class="brief-cue"><strong>Route ${esc(route.routeShortName)} · ${esc(route.routeLongName)}</strong><span>${esc(route.scheduledStopCallsInWindow)} scheduled stop calls at ${esc(route.nearbyStopCount)} stops within 1.2 km of the candidate stadium point; nearest listed stop ${esc(route.nearestStops[0]?.name)} at ${esc(route.nearestStops[0]?.distanceKm)} km.</span>${link(picture.ridekcContext.sourceUrl,'RideKC GTFS')}</div>`).join('')}<p>Route 47 service-change page: ${esc(humanLabel(picture.ridekcContext.alertState))}. ${link(picture.ridekcContext.alertsUrl,'Official service alerts')}</p><p>Static timetable, not a live bus arrival or confirmed game-day service. Straight-line stop distance is not a walking route or stadium entrance; verify times and access with RideKC.</p></details>`:'')+
    (game.id==='nfl:401873006'?`<details class="brief-details"><summary>Chiefs–Chargers game center · ${esc(humanLabel(picture.chiefsPlanContext.state))}</summary><p>Official Chiefs page checked ${esc(fmt(picture.chiefsPlanContext.asOf))}; publisher publication time unavailable. Listed kickoff ${esc(fmt(game.kickoff))}.</p>${picture.chiefsPlanContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.id.replaceAll('_',' '))}</strong><span>${esc(item.summary)}${item.plannedOpeningAt?' Illustrative opening from listed kickoff: '+esc(fmt(item.plannedOpeningAt))+'.':''}</span>${link(item.sourceUrl,'Chiefs game center')}</div>`).join('')}<p>These are relative club plans; actual gate, parking, tailgate and crowd conditions are unverified. Confirm with the club before operational use.</p></details>`:'')+
    (game.id==='nfl:401872984'?`<details class="brief-details"><summary>Titans–Texans game-day guide · ${esc(humanLabel(picture.titansGuideContext.state))}</summary><p>Official Titans guide checked ${esc(fmt(picture.titansGuideContext.asOf))}; publisher publication time unavailable. Parking, ticket-office, tailgate, gate, and service details are published plans.</p>${picture.titansGuideContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.id.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Titans guide')}</div>`).join('')}<p>Actual venue operations are unverified. Confirm current details with the club and operators.</p></details>`:'')+
    (game.id==='nfl:401872992'?`<details class="brief-details"><summary>Seahawks–49ers game-day guide · ${esc(humanLabel(picture.seahawksGuideContext.state))}</summary><p>Official Seahawks guide checked ${esc(fmt(picture.seahawksGuideContext.asOf))}; publisher publication time unavailable. Transit, gate, ceremony and flyover details are published plans.</p>${picture.seahawksGuideContext.claims.map(item=>`<div class="brief-cue"><strong>${esc(item.category.replaceAll('_',' '))}</strong><span>${esc(item.summary)}</span>${link(item.sourceUrl,'Seahawks guide')}</div>`).join('')}<p>Named-person attendance, train runs, aircraft flight, current NOTAM terms and venue operations are unverified. ${link(picture.clubAviationContext.faaSourceUrl,'FAA event record')}</p></details>`:'')+
    (game.id==='nfl:401872992'?`<details class="brief-details"><summary>Sound Transit Seahawks service · ${esc(humanLabel(picture.soundTransitContext.state))}</summary><p>Operator timetable checked ${picture.soundTransitContext.asOf?esc(fmt(picture.soundTransitContext.asOf)):'unavailable'}. ${link(picture.soundTransitContext.sourceUrl,'Sound Transit exact-game page')}</p>${picture.soundTransitContext.arrivals.map(item=>`<div class="brief-cue"><strong>${esc(item.line)} Line trip ${esc(item.tripId)}</strong><span>Scheduled Seattle arrival ${esc(fmt(item.seattleArrivalAt))}</span></div>`).join('')}${picture.sounderGateContext.state==='published_schedule_compared'?`<p>Club gates are published for ${esc(fmt(picture.sounderGateContext.gateOpensAt))}; ${esc(picture.sounderGateContext.arrivalsBeforeGate)} scheduled Seattle arrivals precede that time, ${esc(picture.sounderGateContext.arrivalsAfterGate)} follow it.</p>`:''}<p>${esc(picture.sounderGateContext.interpretation||'Current operator and club plans could not be aligned.')}</p><p>Return trains are scheduled relative to game end; verify actual service with Sound Transit. No live train position, crowd count, or venue access is established.</p></details>`:'')+
    (game.id==='nfl:401872992'?`<details class="brief-details"><summary>Sound Transit Sounder alerts · ${esc(humanLabel(picture.sounderAlertsContext.state))}</summary><p>Operator GTFS real-time feed timestamp ${picture.sounderAlertsContext.sourceAt?esc(fmt(picture.sounderAlertsContext.sourceAt)):'unavailable'}; ${esc(picture.sounderAlertsContext.overlapCount)} route notices overlap the illustrative event window.</p>${picture.sounderAlertsContext.alerts.map(item=>`<div class="brief-cue"><strong>${esc(humanLabel(item.effect))} · ${esc(item.header)}</strong><span>Sounder routes ${esc(item.routes.map(humanLabel).join(', '))} · ${item.eventNamed?'operator notice names this game':'route or station context; game impact unverified'}${item.eventWindowOverlap?' · active period overlaps event window':''}</span>${link(item.sourceUrl,'Operator notice')}</div>`).join('')}<p>${esc(picture.sounderAlertsContext.interpretation||'Current alerts unavailable; check the operator.')}</p><p>${link(picture.sounderAlertsContext.feedUrl,'Official feed')} · ${link(picture.sounderAlertsContext.termsUrl,'Sound Transit data terms')}</p></details>`:'')+
    (game.venue.id==='3673'?`<details class="brief-details"><summary>Seattle Fire dispatch area count · ${esc(humanLabel(picture.seattleFireContext.state))}</summary>${picture.seattleFireContext.state==='recent_area_count'?`<p>${esc(picture.seattleFireContext.nearbyCount)} source-listed dispatches within 5 km of the unreviewed Lumen point in the two-hour Seattle local window ${esc(picture.seattleFireContext.windowStartLocal)} to ${esc(picture.seattleFireContext.windowEndLocal)}. Dataset updated ${esc(fmt(picture.seattleFireContext.sourceUpdatedAt))}. Checked ${esc(fmt(picture.seattleFireContext.checkedAt))} via ${esc(picture.seattleFireContext.retrievalMode==='browser_direct'?'direct browser query':picture.seattleFireContext.retrievalMode==='scheduled_snapshot'?'hourly published snapshot':picture.seattleFireContext.retrievalMode==='local_server_direct'?'direct local server query':'unspecified retrieval')}.</p>`:'<p>Current aggregate unavailable; no count can be inferred.</p>'}<p>${esc(picture.seattleFireContext.interpretation||'The source does not establish stadium impact or a threat.')}</p><p>Only a count is requested and retained; no incident addresses, IDs or response types. ${link(picture.seattleFireContext.sourceUrl,'Seattle Fire dataset')}</p></details>`:'')+
    (['nfl:401872990','nfl:401872992'].includes(game.id)?`<details class="brief-details"><summary>Club flyover and FAA event record · ${esc(picture.clubAviationContext.state.replaceAll('_',' '))}</summary><p>${esc(picture.clubAviationContext.summary)}</p>${picture.clubAviationContext.faaRecord?`<p>FAA listed event window: ${esc(fmt(picture.clubAviationContext.faaRecord.startAt))} to ${esc(fmt(picture.clubAviationContext.faaRecord.endAt))}; status ${esc(humanLabel(picture.clubAviationContext.faaRecord.status))}.</p>`:''}<p>FAA TFR list: ${esc(picture.clubAviationContext.tfrListState||'unavailable')}. ${link(picture.clubAviationContext.clubSourceUrl,'Club announcement')} · ${link(picture.clubAviationContext.faaSourceUrl,'FAA event record')} · ${link(picture.clubAviationContext.tfrSourceUrl,'FAA TFR review')}</p><p>This comparison does not establish a flight, current NOTAM authorization, drone presence, or threat.</p></details>`:'')+
    (['current forecast','current event-hour forecast'].includes(picture.forecastContext.state)?`<div class="brief-cue"><strong>${picture.forecastContext.state==='current event-hour forecast'?'NWS EVENT-HOUR FORECAST':'NWS KICKOFF FORECAST'} · ${esc(picture.forecastContext.period.shortForecast)}</strong><span>${picture.forecastContext.period.temperature==null?'Temperature unavailable':esc(picture.forecastContext.period.temperature)+'°'+esc(picture.forecastContext.period.temperatureUnit||'')} · wind ${esc(picture.forecastContext.period.windSpeed||'not supplied')} ${esc(picture.forecastContext.period.windDirection||'')} · precipitation ${picture.forecastContext.period.precipitationPercent==null?'not supplied':esc(picture.forecastContext.period.precipitationPercent)+'%'} · checked ${esc(fmt(picture.forecastContext.checkedAt))}. Forecast, not an observed condition or threat finding.</span>${link(picture.forecastContext.sourceUrl,'NWS hourly forecast')}</div>`:'')+
    (picture.cues.length?`<div class="brief-cues">${picture.cues.map(cue=>`<div class="brief-cue"><strong>${esc(humanLabel(cue.type))} · ${esc(cue.title)}</strong><span>${esc(cue.basis)}${cue.sourceAt?' · source time '+esc(fmt(cue.sourceAt)):''}</span>${cue.relatedSourceUrl?link(cue.relatedSourceUrl,'Club plan'):''}${link(cue.sourceUrl,cue.type==='road condition'?'Agency data layer':cue.type==='regional road advisory'?'AZ511 public alert':cue.type==='transit alert'?'Transit agency alert':cue.type==='convective outlook'?'NOAA SPC outlook':cue.type==='excessive rainfall outlook'?'NOAA WPC outlook':'NWS alert')}</div>`).join('')}${total>picture.cues.length?`<p>These panels show bounded samples. Consult the agency feeds for the complete set of source records.</p>`:''}</div>`:'')+
    (direct?`<details class="brief-details"><summary>Selected-game ESPN check · ${esc(humanLabel(direct.state))}</summary>${direct.state==='checked'?`<p>Checked ${esc(fmt(direct.checkedAt))} · ESPN status ${esc(direct.sourceStatus)}${direct.gameState?` · ${esc(direct.gameState.away.name)} ${esc(direct.gameState.away.score)}, ${esc(direct.gameState.home.name)} ${esc(direct.gameState.home.score)}`:''}${direct.reportedAttendance!=null?` · publisher-reported attendance ${esc(direct.reportedAttendance)}`:''}.</p>${direct.article?`<p>Game-linked ${esc(direct.article.type.toLowerCase())} headline: ${esc(direct.article.headline)} ${link(direct.article.url,'ESPN article')}</p>`:''}${direct.scheduleDiffers?'<p>The direct game date differs from the published schedule. Confirm with the NFL or host club before using event-time screening.</p>':''}`:`<p>Direct check unavailable or identity mismatch; the dated published snapshot remains separate.</p>`}<p>Browser query for this selected game only. Publisher observations do not establish attendance of a named person, crowd movement, venue impact, or a threat. ${link(direct.sourceUrl,'ESPN game summary')}</p></details>`:'')+
    `<details class="brief-details"><summary>Game-linked ESPN article · ${esc(humanLabel(gameArticle.state))}</summary>${gameArticle.state==='current_snapshot'?`<div class="brief-cue"><strong>${esc(gameArticle.article.headline)}</strong><span>${esc(gameArticle.article.type)} · published ${esc(fmt(gameArticle.article.publishedAt))} · revised ${esc(fmt(gameArticle.article.modifiedAt))} · snapshot ${esc(fmt(gameArticle.asOf))}</span>${link(gameArticle.article.url,'ESPN game article')}</div>`:'<p>No current exact-game article is available in this snapshot.</p>'}<p>Publisher headline metadata keyed to this game ID. Read the article before using any claim; it does not verify attendance, venue impact, or a threat. ${link(gameArticle.sourceUrl,'ESPN game summary')}</p></details>`+
    `<details class="brief-details"><summary>NFL publisher headlines · ${news.state==='current_snapshot'?news.matchupCandidates.length+' matchup-title candidate'+(news.matchupCandidates.length===1?'':'s')+' · '+news.teamDiscovery.length+' broader team mention'+(news.teamDiscovery.length===1?'':'s'):esc(humanLabel(news.state))}</summary>${news.state==='current_snapshot'?news.articles.length?news.articles.map(item=>`<div class="brief-cue"><strong>${esc(humanText(item.title))}</strong><span>${esc(item.description)} · ${esc(item.publisher)} · ${esc(fmt(item.publishedAt))} · ${({matchup_phrase_in_title:'Matchup phrase in title',both_teams_in_title:'Both teams in title',both_teams_mentioned:'Both teams mentioned',one_team_mentioned:'One team mentioned'}[item.matchBasis]||'Team mention')}</span>${link(item.url,'Full publisher article')}</div>`).join(''):`<p>No team-name match in the current connected NFL headline snapshots. This does not establish an absence of relevant news.</p>`:'<p>NFL publisher headline snapshot is unavailable or stale.</p>'}<p>Publisher checks: ${news.sources.map(item=>`${esc(item.publisher||'unknown')} ${esc(humanLabel(item.state))} ${link(item.sourceUrl,'Publisher feed')}`).join(' · ')}. ${news.coverage==='partial'?'Coverage is partial. ':''}Headlines and any shown descriptions are publisher supplied. Team-name matching is discovery context; it does not confirm relevance to this game, a person’s attendance, venue impact, or a threat.</p></details>`+
    `<details class="brief-details"><summary>Zone and sensor status</summary><div class="brief-grid">${picture.zoneReview.map(zone=>`<div><strong>${esc(zone.name)}</strong><span>${esc(humanLabel(zone.state))} · ${esc(zone.owner)}</span><small>${esc(zone.purpose)} ${link(zone.sourceUrl,'Source')}</small></div>`).join('')}</div></details><details class="brief-details"><summary>Source status and gaps</summary><div class="brief-grid">${picture.sources.map(source=>`<div><strong>${esc(source.name)}</strong><span>${esc(humanLabel(source.state))}${source.asOf?' · '+esc(fmt(source.asOf)):''}</span><small>${esc(humanText(source.detail))} ${link(source.sourceUrl,'Source')}</small></div>`).join('')}</div><p><strong>Unresolved for this brief</strong></p><ul>${picture.gaps.map(gap=>`<li>${esc(humanText(gap))}</li>`).join('')}</ul></details>${publishedLink}<button type="button" class="report-download">Download current public-source report (Markdown)</button> <button type="button" class="evidence-download">Download public evidence bundle (JSON)</button><p class="bundle-note">Both downloads reflect the latest loaded public evidence for this game. They are point-in-time, unreviewed exports; no threat assessment or named-person records.</p>`;
  target.insertAdjacentHTML('beforeend',renderSofiContext(selectSofiContext(game,inputs)));
  target.querySelector('.report-download').onclick=()=>downloadPublicReport(game);
  target.querySelector('.evidence-download').onclick=()=>downloadEvidenceBundle(game);
}
function renderExercise(game){
  const target=$('exercise');if(!target||!game)return;
  const heading=`<div class="exercise-head"><span class="exercise-label">SIMULATED EXERCISE · FICTIONAL DATA</span><button type="button" class="exercise-toggle" aria-pressed="${exerciseEnabled}">${exerciseEnabled?'Close exercise':'Open exercise mode'}</button></div>`;
  if(!exerciseEnabled){target.innerHTML=heading+'<p>Replay an evidence-linked threat briefing across every source domain in the design brief. Exercise records are separate from the public-source event picture and its downloadable evidence bundle.</p>';target.querySelector('.exercise-toggle').onclick=()=>{exerciseEnabled=true;renderExercise(game)};return}
  const brief=buildExerciseBrief(exerciseStage);
  target.innerHTML=heading+`<p><strong>Exercise venue:</strong> ${esc(game.venue.name)}. The venue and schedule are real source records; every observation below is fictional. ${esc(brief.assessment.model)}. Severity and confidence are not assessed.</p><div class="exercise-steps">${exerciseStages.map((stage,index)=>`<button type="button" data-stage="${index}" aria-pressed="${index===exerciseStage}">${esc(stage.label)}</button>`).join('')}<button type="button" class="exercise-play">${exercisePlaybackTimer?'Pause replay':exerciseStage===exerciseStages.length-1?'Replay from start':'Play scenario'}</button></div><p class="feed-state" aria-live="polite">PLAYBACK CLOCK ${esc(brief.clock)} · ${brief.observations.length} FICTIONAL SIGNALS · ${brief.correlations.length} REVIEW CANDIDATES</p><h5>Cross-source review candidates</h5>`+
    (brief.correlations.length?`<div class="exercise-correlations">${brief.correlations.map(item=>`<div class="exercise-correlation"><strong>${esc(humanText(item.title))}</strong><span>${esc(humanLabel(item.state))} · evidence ${esc(item.evidence.join(', '))}</span><p>${esc(humanText(item.basis))}</p><small>Analyst action: ${esc(item.next)}</small></div>`).join('')}</div>`:'<p>Signals are visible; no cross-source candidate meets the exercise rule yet.</p>')+
    `<h5>Source domains and examples</h5><div class="exercise-domains">${brief.domains.map(domain=>`<details><summary>${esc(domain.name)} <span>${domain.count} observed / ${domain.sources.length} source types</span></summary><ul>${domain.sources.map(source=>`<li>${esc(source)}</li>`).join('')}</ul></details>`).join('')}</div><details class="exercise-observations"><summary>Inspect fictional evidence ledger (${brief.observations.length})</summary><ol>${brief.observations.map(item=>`<li><strong>${esc(item.id)} · ${esc(item.source)}</strong><span> T+${String(item.minute).padStart(2,'0')} · ${esc(item.reliability)}</span><p>${esc(item.summary)}</p></li>`).join('')}</ol></details><button type="button" class="exercise-download">Download simulated exercise brief (JSON)</button><p class="exercise-limit">${esc(brief.limitations.join(' '))}</p>`;
  target.querySelector('.exercise-toggle').onclick=()=>{clearInterval(exercisePlaybackTimer);exercisePlaybackTimer=null;exerciseEnabled=false;renderExercise(game)};
  target.querySelectorAll('[data-stage]').forEach(button=>button.onclick=()=>{clearInterval(exercisePlaybackTimer);exercisePlaybackTimer=null;exerciseStage=Number(button.dataset.stage);renderExercise(game)});
  target.querySelector('.exercise-play').onclick=()=>{
    if(exercisePlaybackTimer){clearInterval(exercisePlaybackTimer);exercisePlaybackTimer=null;renderExercise(game);return}
    if(exerciseStage===exerciseStages.length-1)exerciseStage=0;
    exercisePlaybackTimer=setInterval(()=>{
      if(selected!==game.id||!exerciseEnabled){clearInterval(exercisePlaybackTimer);exercisePlaybackTimer=null;return}
      exerciseStage++;
      if(exerciseStage>=exerciseStages.length-1){exerciseStage=exerciseStages.length-1;clearInterval(exercisePlaybackTimer);exercisePlaybackTimer=null}
      renderExercise(game);
    },4000);
    renderExercise(game);
  };
  target.querySelector('.exercise-download').onclick=()=>downloadExerciseBundle(game);
}
async function loadSpaceWeather(){
  try{spaceWeatherSnapshot=await json('noaa_space_weather.json')}catch{spaceWeatherSnapshot={status:'unavailable'}}
  if(selected&&snapshot)renderBrief(snapshot.games.find(game=>game.id===selected));
}
async function loadNtas(){
  const target=$('ntas');
  try{
    const received=await json('ntas.json');
    ntasSnapshot=received;
    const feed=selectNtas(received);
    if(selected&&snapshot)renderBrief(snapshot.games.find(game=>game.id===selected));
    if(feed.state!=='current national snapshot'){
      target.innerHTML=`<p>Advisory snapshot unavailable or more than 12 hours old. Check ${link(feed.sourceUrl||'https://www.dhs.gov/ntas/1.1/feed.xml','DHS NTAS')} directly.</p>`;
      return;
    }
    target.innerHTML=`<p class="feed-state">DHS FEED RETRIEVED ${esc(fmt(feed.retrievedAt))} · ${esc(feed.activeCount)} ACTIVE ENTRIES</p>`+
      (feed.activeCount?feed.active.map(item=>`<div class="camera-row"><strong>${esc(item.type)}</strong><span>Published interval ${esc(fmt(item.start))} to ${esc(fmt(item.end))}${item.locations?.length?' · Listed locations: '+esc(item.locations.join(', ')):''}${item.sectors?.length?' · Listed sectors: '+esc(item.sectors.join(', ')):''}</span><span>${esc(item.summary)}</span>${link(item.url,'DHS advisory')}</div>`).join(''):'<p>The DHS feed returned no active entries at this snapshot time.</p>')+
      `<p>National advisories are context, not a finding about any NFL game or venue. A zero-entry feed does not establish absence of threats. ${link(feed.sourceUrl,'DHS feed')}</p>`;
  }catch{
    ntasSnapshot={status:'failed'};
    if(selected&&snapshot)renderBrief(snapshot.games.find(game=>game.id===selected));
    target.innerHTML=`<p>Advisory snapshot unavailable. Check ${link('https://www.dhs.gov/ntas/1.1/feed.xml','DHS NTAS')} directly.</p>`;
  }
}
async function loadGameArticles(){
  try{gameArticlesSnapshot=await json('game_articles.json')}catch{gameArticlesSnapshot={status:'failed'}}
  if(selected&&snapshot)renderBrief(snapshot.games.find(game=>game.id===selected));
}
async function loadNews(){
  try{newsSnapshot=await json('news.json')}catch{newsSnapshot={status:'failed'}}
  if(selected&&snapshot)renderBrief(snapshot.games.find(game=>game.id===selected));
}
function renderCoverage(){
  const target=$('coverage');
  if(!target||!snapshot)return;
  const result=summarizeCoverage(snapshot.games,cameraSnapshot,roadSnapshot);
  const label={connected:'Connected snapshot',directory_only:'Publisher directory only',not_connected:'No connector',source_failed:'Configured source failed',stale:'Stale snapshot',unavailable:'Unavailable',candidate:'Unreviewed point',unmapped:'No point'};
  const ground=groundSnapshot?.byVenue||{};
  target.innerHTML=`<div class="coverage-totals"><div><strong>${result.points}/${result.total}</strong><span>VENUE POINT CANDIDATES</span></div><div><strong>${Object.keys(ground).length}/${result.total}</strong><span>OSM FOOTPRINT CANDIDATES</span></div><div><strong>${result.cameras}/${result.total}</strong><span>CAMERA METADATA FEEDS</span></div><div><strong>${result.roads}/${result.total}</strong><span>ROAD CONDITION FEEDS</span></div></div>`+
    `<p>Camera and road counts require a source snapshot built within 12 hours. Ground outlines are dated, one-time research candidates and are not approved perimeters. A connected feed does not verify camera video, a venue view, road impact, or completeness. ${!cameraSnapshot||!roadSnapshot?'Some snapshots are still loading or unavailable.':''}</p>`+
    `<details><summary>Inspect coverage for all ${result.total} venues</summary><div class="coverage-scroll"><table class="coverage-table"><thead><tr><th scope="col">Venue</th><th scope="col">Map point</th><th scope="col">OSM outline</th><th scope="col">Camera metadata</th><th scope="col">Road conditions</th></tr></thead><tbody>${result.rows.map(row=>`<tr><th scope="row">${esc(row.name)}<small>${esc(row.address)}</small></th><td>${esc(label[row.point])}</td><td>${ground[row.id]?'Candidate':'No matched outline'}</td><td>${esc(label[row.camera])}</td><td>${esc(label[row.road])}</td></tr>`).join('')}</tbody></table></div></details>`+
    (result.cameraFailed.length||result.roadFailed.length?`<p>Failed sources: ${esc([...result.cameraFailed,...result.roadFailed].join(', '))}.</p>`:'');
  renderVenueMap(result.rows);
}
let geographicExplorer,geographicVisibleIds;const geographicSummaries=new Map();
function renderVenueMap(){
 if(!snapshot)return;
 geographicExplorer ||= createGeographicExplorer({getChangeFeed:()=>publishedChangeFeed,onScopeChange:games=>{geographicVisibleIds=new Set(games.map(game=>game.id));renderList();},openGame:id=>{selectGame(id);showWorkspaceView('event');$('briefing').scrollIntoView({behavior:'smooth',block:'start'});const heading=$('detail').querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});}});
 geographicExplorer.update(snapshot.games,geographicSummaries);
}
function renderGround(game){
  renderEventGeographicMap(game,groundSnapshot,seamsSnapshot);
  const target=$('ground');if(!target)return;
  const item=groundSnapshot?.byVenue?.[game.venue.id];
  target.innerHTML=item?`<p>The green overlay shows the community-mapped stadium outline. It is not an approved security perimeter.</p><p>Last map edit: ${esc(fmt(item.sourceEditedAt))}. ${link(item.sourceUrl,'View original map record')} · ${link(groundSnapshot.licenseUrl,'OpenStreetMap attribution')}</p>`:'<p>No stadium outline is available for this location.</p>';
}
function renderTfr(game){
  const target=$('tfr');if(!target||!game)return;
  if(!tfrSnapshot){target.innerHTML=`<p>FAA TFR list and geometry unavailable. ${link('https://tfr.faa.gov/tfr3/','FAA TFR list')}</p>`;return}
  const age=Date.now()-Date.parse(tfrSnapshot.builtAt),fresh=Number.isFinite(age)&&age>=-60000&&age<12*3600000;
  if(!fresh){target.innerHTML=`<p>FAA TFR snapshot stale. Check ${link(tfrSnapshot.sourcePageUrl,'FAA TFR list')} directly.</p>`;return}
  const matches=tfrSnapshot.byVenue?.[game.venue.id]||[];
  const timing=item=>{
    const state=tfrAtKickoff(game,item);
    if(state==='listed_kickoff_within_notam_window')return `Listed kickoff falls within this parsed UTC window (${fmt(item.startAt)} to ${fmt(item.endAt)}). This does not establish that the NFL game caused the notice.`;
    if(state==='listed_kickoff_outside_notam_window')return `Listed kickoff is outside this parsed UTC window (${fmt(item.startAt)} to ${fmt(item.endAt)}).`;
    if(state==='standing_airspace_context')return 'Standing or permanent airspace restriction; not an event-specific notice.';
    if(state==='kickoff_unverified')return 'Kickoff time is not verified; no time comparison made.';
    return 'Recurring, multi-area, unavailable, or otherwise complex timing; verify the FAA NOTAM directly.';
  };
  target.innerHTML=`<p class="feed-state">FAA TFR LIST, GEOMETRY AND NOTAM DETAIL · SNAPSHOT ${esc(fmt(tfrSnapshot.builtAt))}</p><p>${matches.length?`${matches.length} spatial review candidate${matches.length===1?'':'s'} at this venue candidate point.`:'No spatial match in this snapshot; unrestricted airspace cannot be inferred.'} Single explicit UTC windows are screened against the listed kickoff. Confirm the governing FAA NOTAM before an aviation decision. This feed does not detect drones.</p>${matches.map(item=>`<div class="brief-cue"><strong>${esc(item.notamId)} · ${esc(item.type)}</strong><span>${esc(item.description)}${item.reason?' · FAA reason: '+esc(item.reason):''}</span><small>${esc(timing(item))} ${esc(item.matchBasis)} ${link(item.detailUrl,'FAA detail')}</small></div>`).join('')}<p>${link(tfrSnapshot.sourcePageUrl,'FAA TFR list')}</p>`;
}
async function renderAirspace(game){
  renderEventGeographicMap(game,groundSnapshot,seamsSnapshot);
  const target=$('airspace');
  if(!target)return;
  if(!seamsSnapshot){target.innerHTML='<p>FAA SEAMS snapshot unavailable or still loading. Check the FAA source directly.</p>';return}
  const record=seamsSnapshot.byGame?.[game.id];
  if(!record){target.innerHTML=`<p>No linked NFL event in this FAA SEAMS snapshot. This does not establish unrestricted airspace. ${link(seamsSnapshot.sourceItemUrl,'FAA SEAMS')}</p>`;return}
  const age=Date.now()-Date.parse(seamsSnapshot.builtAt),fresh=age>=0&&age<12*3600000;
  renderEventGeographicMap(game,groundSnapshot,seamsSnapshot);
  target.innerHTML=`<p>${fresh?'FAA boundary snapshot updated '+esc(fmt(seamsSnapshot.builtAt)):'Older FAA boundary snapshot — check the current notice before use.'}</p><p>Published event window: ${esc(fmt(record.startAt))} to ${esc(fmt(record.endAt))}. The airspace overlay concerns aviation; it is not a ground perimeter.</p><p id="airspace-live">Checking current FAA event status…</p><p>${link(seamsSnapshot.sourceItemUrl,'FAA event record')} · ${link('https://tfr.faa.gov/tfr3/','Current FAA notices')}</p>`;
  try{
    const params=new URLSearchParams({where:`OBJECTID=${record.objectId}`,outFields:'OBJECTID,STATUS,IS_ACTIVE,GAME_DATE,END_DATE,updatedAt',returnGeometry:'false',f:'json'});
    const live=await json(`${seamsSnapshot.sourceUrl}/query?${params}`),item=live.features?.[0]?.attributes;
    if(selected!==game.id)return;
    $('airspace-live').innerHTML=item?.OBJECTID===record.objectId?`<span class="feed-state">FAA RECORD CHECKED ${esc(fmt(Date.now()))}</span><br>Status ${esc(item.STATUS)} · ${item.IS_ACTIVE===1?'source marks active':'source does not mark active'} · published window ${esc(fmt(item.GAME_DATE))} to ${esc(fmt(item.END_DATE))}. Source state is informational; confirm with NOTAM.`:'FAA record was not returned on the direct check; status unavailable.';
  }catch(error){if(selected===game.id)$('airspace-live').textContent=`Direct FAA status check unavailable: ${error.message}. Do not infer that the restriction is inactive.`}
}
function cameraStill(item,stale){
  if(stale)return '';
  const caltrans=item.inService===true&&/^https:\/\/cwwp2\.dot\.ca\.gov\/data\/d[47]\/cctv\/image\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg$/.test(item.stillUrl||'');
  const wsdot=item.agency==='WSDOT'&&/^https:\/\/images\.wsdot\.wa\.gov\/[a-z0-9_-]+\/[a-z0-9_-]+\.jpg$/i.test(item.stillUrl||'');
  const tdot=item.agency==='TDOT SmartWay'&&/^tdot-smartway-\d{1,6}$/.test(item.id||'')&&/^https:\/\/tnsnapshots\.com\/thumbs\/R3_\d{3}\.flv\.png$/.test(item.stillUrl||'');
  if(!caltrans&&!wsdot&&!tdot)return '';
  const note=tdot?'TDOT SmartWay public roadway thumbnail · image freshness and field of view unverified · page checks every 30 seconds while selected':wsdot?'WSDOT says this roadway image updates approximately every 5 minutes. The image may lag or be unavailable; inspect its overlaid time. Page checks every 2 minutes while selected.':'Agency current-image endpoint · may show an unavailable placeholder · check any overlaid timestamp · page checks every 2 minutes while selected';
  return `<div class="camera-image"><img class="camera-still" src="${esc(item.stillUrl)}?t=${Date.now()}" data-src="${esc(item.stillUrl)}" alt="Agency roadway camera image near ${esc(item.name)}" loading="lazy" referrerpolicy="no-referrer"><small>${esc(note)}</small></div>`;
}
const marylandViewer=url=>/^https:\/\/chart\.maryland\.gov\/Video\/GetVideo\/[a-f0-9]{32}$/i.test(url||'');
function stopCameraFrame(){
  if(!cameraFrame)return;
  const {frame,button}=cameraFrame;
  frame.removeAttribute('src');frame.closest('.camera-video').hidden=true;
  if(button?.isConnected)button.textContent='Show official CHART video';
  cameraFrame=null;
}
function toggleCameraFrame(button){
  const url=button.dataset.frameUrl,container=button.nextElementSibling,frame=container?.querySelector('iframe');
  if(!marylandViewer(url)||!frame)return;
  if(cameraFrame?.frame===frame){stopCameraFrame();return}
  stopCameraFrame();stopCameraVideo();
  container.hidden=false;frame.src=url;button.textContent='Stop official CHART video';cameraFrame={frame,button};
}
function stopCameraVideo(){
  if(!cameraPlayer)return;
  const {video,hls}=cameraPlayer;
  const container=video.closest('.camera-video'),button=container?.previousElementSibling;
  video.onplaying=null;video.ontimeupdate=null;video.onerror=null;video.onwaiting=null;video.onstalled=null;
  const status=container?.querySelector('.camera-video-status');if(status)status.textContent='Stream stopped.';
  video.pause();hls?.destroy();video.removeAttribute('src');video.load();cameraPlayer=null;
  if(container)container.hidden=true;
  if(button?.classList.contains('camera-video-toggle'))button.textContent='Play public roadway video';
}
function loadHls(){
  if(window.Hls)return Promise.resolve(window.Hls);
  if(!hlsLoader)hlsLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('vendor/hls.min.js',import.meta.url).href;
    script.onload=()=>window.Hls?resolve(window.Hls):reject(Error('HLS player unavailable'));
    script.onerror=()=>reject(Error('HLS player script unavailable'));document.head.append(script);
  }).catch(error=>{hlsLoader=null;throw error});
  return hlsLoader;
}
async function playCameraVideo(button,game,onFailure){
  const url=button.dataset.videoUrl,container=button.nextElementSibling,video=container?.querySelector('video'),status=container?.querySelector('.camera-video-status');
  const agency=publicRoadVideoAgency({agency:button.dataset.agency,id:button.dataset.cameraId,inService:button.dataset.inService==='true',videoUrl:url});
  if(!agency||!video||!status)return;
  if(cameraPlayer?.video===video){stopCameraVideo();container.hidden=true;button.textContent='Play public roadway video';return}
  stopCameraVideo();stopCameraFrame();container.hidden=false;button.textContent='Stop public roadway video';status.textContent=`Connecting to ${agency} public roadway stream…`;
  cameraPlayer={video,hls:null};
  let failed=false;
  const reportFailure=()=>{
    if(cameraPlayer?.video!==video)return;
    status.textContent=`Inline playback failed in this browser. The ${agency} stream may still be available in the official camera viewer linked below.`;
    if(!failed){failed=true;onFailure?.()}
  };
  let playbackBaseline=null;
  video.onplaying=()=>{if(cameraPlayer?.video===video){playbackBaseline=video.currentTime;status.textContent='Playback started; checking that video frames and media time advance.'}};
  video.ontimeupdate=()=>{if(cameraPlayer?.video===video&&advancingMedia(playbackBaseline,video))status.textContent='Roadway video is advancing in this browser. Capture time, latency and stadium visibility remain unverified.'};
  video.onwaiting=video.onstalled=()=>{if(cameraPlayer?.video===video)status.textContent='Video is buffering; current playback is not confirmed. Check the agency viewer if updates do not resume.'};
  video.onerror=reportFailure;
  try{
    if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;await video.play()}
    else{
      const Hls=await loadHls();
      if(selected!==game.id||!button.isConnected||cameraPlayer?.video!==video)return;
      if(!Hls.isSupported())throw Error('Browser does not support HLS playback');
      const hls=new Hls({enableWorker:true,maxBufferLength:20});cameraPlayer.hls=hls;
      hls.on(Hls.Events.MEDIA_ATTACHED,()=>hls.loadSource(url));
      hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{status.textContent='Press play to start the public roadway stream.'}));
      hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)reportFailure()});
      hls.attachMedia(video);
    }
  }catch{reportFailure()}
}
function appendFloridaPublisherMap(target,game){
  const url=fl511EmbedUrl(game);
  if(!url)return;
  target.insertAdjacentHTML('beforeend',`<div class="camera-row"><strong>Florida 511 official roadway map</strong><p>Open the publisher’s map centered on the unreviewed ${esc(game.venue.name)} point, with public traffic-camera, closure, and incident layers selected. Camera views are roadway views; availability, capture time, direction, and visibility of the stadium are unverified. Event Atlas does not copy or analyze Florida 511 imagery or incident data.</p><button type="button" class="camera-video-toggle fl511-map-toggle">Open official map</button><div class="publisher-road-map" hidden><iframe title="Florida 511 official roadway map near ${esc(game.venue.name)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" allow="fullscreen" allowfullscreen></iframe></div><small>${link(fl511EmbedToolUrl,'Florida 511 publisher embed tool')} · ${link('https://fl511.com/','Open Florida 511 directly')}</small></div>`);
  const button=target.querySelector('.fl511-map-toggle'),container=target.querySelector('.publisher-road-map'),frame=container?.querySelector('iframe');
  button.onclick=()=>{if(container.hidden){container.hidden=false;frame.src=url;button.textContent='Close official map'}else{frame.removeAttribute('src');container.hidden=true;button.textContent='Open official map'}};
}
function renderCameras(game){
  const target=$('cameras');
  if(!target)return;
  stopCameraVideo();
  stopCameraFrame();
  if(cameraRefreshTimer){clearInterval(cameraRefreshTimer);cameraRefreshTimer=null}
  if(!cameraSnapshot){target.innerHTML='<p>Camera metadata snapshot unavailable.</p>';appendFloridaPublisherMap(target,game);return}
  const sources=cameraSnapshot.sources||[];
  const inventory=cameraSnapshot.byVenue?.[game.venue.id];
  const covered=Array.isArray(inventory);
  if(inventory!==undefined&&!covered){target.innerHTML='<p>Camera inventory unavailable because the published venue records are invalid. No coverage conclusion can be drawn.</p>';appendFloridaPublisherMap(target,game);return}
  const items=covered?inventory:[];
  const failed=failedSourcesForVenue(game.venue,sources,'camera');
  const builtAt=Date.parse(cameraSnapshot.builtAt);
  const stale=!Number.isFinite(builtAt)||builtAt>Date.now()+60000||Date.now()-builtAt>12*3600000;
  target.innerHTML=`<p class="feed-state">PUBLIC ROADWAY CAMERAS · SNAPSHOT ${esc(fmt(cameraSnapshot.builtAt))}</p>`+
    `<p>${covered?'Nearest agency-listed cameras within 15 km of the venue candidate point. Distance does not establish a stadium view, live image, or access to venue security cameras.':'No connected agency roadway-camera inventory for this venue.'}${game.venue.id==='3493'?' <a href="https://511la.org/cctv" target="_blank" rel="noopener noreferrer">Open the official 511LA camera directory ↗</a>. Event Atlas does not ingest or display individual 511LA cameras or streams; no Superdome view is verified.':''}${game.venue.id==='3738'&&covered?' Massachusetts records come from a public MassDOT staging asset layer with unknown upstream freshness. Live imagery requires separate TrafficLand access; the Mass511 link is a general camera directory.':''}${stale?' Snapshot freshness cannot be verified; its time is invalid, in the future, or more than 12 hours old.':''}</p>`+
    (items.length?items.map(item=>`<div class="camera-row"><strong>${esc(item.name)}</strong><span>${esc(item.agency)} · ${esc(item.distanceKm)} km · ${item.operationalStatus?'source status '+esc(humanLabel(item.operationalStatus)):item.inService===null?'service status not supplied':item.inService?'listed in service':'listed out of service'}${item.statusAsOf?' · source cache '+esc(fmt(item.statusAsOf)):''}${item.metadataDate?' · metadata dated '+esc(item.metadataDate):''}</span>${cameraStill(item,stale)}${item.videoPlaylistStatus==='playlist_unavailable_at_sync'?'<small>Agency lists a stream, but its playlist was unavailable in the latest build; check the agency viewer.</small>':''}${!stale&&publicRoadVideoAgency(item)?`<button type="button" class="camera-video-toggle" data-agency="${esc(item.agency)}" data-camera-id="${esc(item.id)}" data-in-service="${item.inService===true}" data-video-url="${esc(item.videoUrl)}">Play public roadway video</button><div class="camera-video" hidden><video controls muted playsinline preload="none" aria-label="${esc(item.agency)} roadway camera near ${esc(item.name)}"></video><small class="camera-video-status">Agency stream not yet started. Camera direction and stadium view are unverified.</small></div>`:''}${!stale&&item.agency==='Maryland CHART'&&item.operationalStatus==='OK'&&marylandViewer(item.viewerUrl)?`<button type="button" class="camera-video-toggle camera-frame-toggle" data-frame-url="${esc(item.viewerUrl)}">Show official CHART video</button><div class="camera-video" hidden><iframe title="Maryland CHART roadway camera near ${esc(item.name)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen" allowfullscreen></iframe><small>Official CHART public viewer. Source status is from its last cache update; playback, latency, field of view and stadium visibility are unverified. No video is stored by Event Atlas.</small></div>`:''}<span>${link(item.viewerUrl,item.viewerKind==='unverified_still'?'Agency image URL (freshness unverified)':item.agency==='MoDOT Traveler Information'?'Open MoDOT public camera map':item.viewerKind==='directory_only'?'Agency camera directory':item.agency==='TDOT SmartWay'?'Open TDOT camera player':'Agency camera viewer')} · ${link(item.sourceUrl,'Metadata source')}</span></div>`).join(''):covered?'<p>No nearby camera metadata in this agency snapshot.</p>':'')+
    (failed.length?`<p>Unavailable source: ${esc(failed.map(source=>humanLabel(source.id)).join(', '))}. The displayed coverage may be incomplete.</p>`:'');
  appendFloridaPublisherMap(target,game);
  for(const row of target.querySelectorAll('.camera-row')){
    const video=Boolean(row.querySelector('video,.camera-frame-toggle')),image=Boolean(row.querySelector('.camera-still')),directory=/Agency camera directory|Open MoDOT public camera map/.test(row.textContent);
    const badge=document.createElement('small');badge.className='camera-access-label';badge.textContent=video&&image?'Video player and roadway image preview':video?'Video player available':image?'Roadway image preview':directory?'Directory link only — open the publisher to find views':'Camera information and publisher link — no inline footage';
    row.querySelector('strong')?.after(badge);
  }
  const images=[...target.querySelectorAll('.camera-still')];
  for(const img of images)img.addEventListener('load',()=>{const note=img.closest('.camera-image').querySelector('small');const cadence=img.dataset.refreshNote||(img.dataset.refreshNote=note.textContent);note.textContent='Image loaded '+fmt(Date.now())+'. Publisher capture time and stadium visibility are unverified; inspect any overlaid timestamp. '+cadence;});
  for(const button of target.querySelectorAll('.camera-video-toggle:not(.camera-frame-toggle):not(.fl511-map-toggle)'))button.onclick=()=>playCameraVideo(button,game);
  for(const button of target.querySelectorAll('.camera-frame-toggle'))button.onclick=()=>toggleCameraFrame(button);
  const verifiedButtons=items.filter(item=>item.videoPlaylistStatus==='playlist_reachable_at_sync'&&publicRoadVideoAgency(item))
    .map(item=>[...target.querySelectorAll('.camera-video-toggle[data-camera-id]')].find(button=>button.dataset.cameraId===item.id)).filter(Boolean);
  const startVerifiedVideo=index=>{
    if(selected!==game.id||document.visibilityState!=='visible')return;
    const button=verifiedButtons[index];
    if(button)playCameraVideo(button,game,()=>startVerifiedVideo(index+1));
  };
  startVerifiedVideo(0);
  for(const img of images)img.addEventListener('error',()=>{img.closest('.camera-image').querySelector('small').textContent='Agency image unavailable. Use the agency viewer.';img.hidden=true});
  if(images.length)cameraRefreshTimer=setInterval(()=>{
    if(selected!==game.id){clearInterval(cameraRefreshTimer);cameraRefreshTimer=null;return}
    for(const img of images)if(!img.hidden)img.src=img.dataset.src+'?t='+Date.now();
  },game.venue.id==='3810'?30000:120000);
}
function appendPhillyPermitPlanning(game,target){
  if(game.venue.id!=='3806')return;
  const feed=phillyPermitsSnapshot,context=feed?.byGame?.[game.id],builtAt=Date.parse(feed?.builtAt);
  if(feed?.status!=='ok'||!context||!Number.isFinite(builtAt)||Date.now()-builtAt>12*3600000||builtAt>Date.now()+60000){
    target.insertAdjacentHTML('beforeend',`<p>Philadelphia permitted road-work data is loading, stale, or unavailable. ${link(phillyLanePermitLayer,'City permit layer')}</p>`);
    return;
  }
  const items=context.nearest.map(item=>`<div class="camera-row"><strong>${esc(item.occupancyType||'Permitted occupancy')} · ${esc(item.address||'Address unavailable')}</strong><span>Permit ${esc(item.permitNumber||item.id)} · ${esc(item.distanceKm)} km from the unreviewed venue point · source status ${esc(humanLabel(item.status))} · effective dates ${esc(item.effective)} to ${esc(item.expires)}</span>${link(phillyLanePermitLayer,'City permit layer')}</div>`).join('');
  target.insertAdjacentHTML('beforeend',`<p class="feed-state">PHILADELPHIA STREET PERMITS · BUILT ${esc(fmt(feed.builtAt))}</p><p>${esc(context.permitCount)} distinct permitted-work records across ${esc(context.segmentCount)} mapped street segments within 2 km have source effective-date spans that include the listed ${esc(context.gameDate)} game date.</p>${items||'<p>No date-matched permits in this source query. That does not establish clear routes.</p>'}<p>These are permits, not verified active closures. Dates have day precision; work at kickoff, affected routes, stadium access impact, and threat relevance require confirmation with the City. ${link('https://opendataphilly.org/datasets/street-lane-closures/','City dataset description')}</p>`);
}
function renderNj511(game){
  const target=$('nj511');if(!target)return;
  if(game.venue.id!=='3839'){target.innerHTML='<p>511NJ MetLife event matching applies only to games at MetLife Stadium.</p>';return}
  const context=selectNj511ForGame(game,nj511Snapshot);
  target.innerHTML=`<p class="feed-state">511NJ · ${esc(humanLabel(context.state))}${context.sourceAt?' · SOURCE '+esc(fmt(context.sourceAt)):''}</p>${(context.eventListings||[]).map(item=>`<div class="camera-row"><strong>Exact-game traffic listing</strong><span>${esc(item.description)}</span><small>Published ${esc(fmt(item.publishedAt))}</small></div>`).join('')}${context.gameDateRoadCount!=null?`<p>${esc(context.gameDateRoadCount)} road entr${context.gameDateRoadCount===1?'y':'ies'} within 8 km of the candidate point mention${context.gameDateRoadCount===1?'s':''} the listed game date.</p>`:''}${(context.gameDateRoads||[]).slice(0,8).map(item=>`<div class="camera-row"><strong>${esc(humanText(item.title))}</strong><span>${esc(item.description)}</span><small>${esc(item.distanceKm)} km · published ${esc(fmt(item.publishedAt))}</small></div>`).join('')}<p>The source mixes present and planned events. Same date and proximity do not establish a kickoff-time overlap, open lane, stadium access impact, or threat. Confirm current road status with ${link(nj511EventsPage,'511NJ')} · ${link(context.sourceUrl,'511NJ RSS')}.</p>`;
}
function renderRoads(game){
  const target=$('roads');
  if(!target)return;
  const roadsData=selectedRoadSnapshot(game);
  if(!roadsData){target.innerHTML='<p>Road condition snapshot unavailable.</p>';appendPhillyPermitPlanning(game,target);return}
  const context=selectRoadContext(game,roadsData);
  const failed=failedSourcesForVenue(game.venue,roadsData.sources,'road');
  const ilSource=game.venue.address.endsWith('IL, USA')?roadsData.sources.find(source=>source.id==='idot-closure-incidents'):null;
  const wiSource=game.venue.address.endsWith('WI, USA')?roadsData.sources.find(source=>source.id==='wisdot-511-events-green-bay'):null;
  const laSource=game.venue.address.endsWith('LA, USA')?roadsData.sources.find(source=>source.id==='ladotd-511-new-orleans'):null;
  const mnSource=game.venue.address.endsWith('MN, USA')?roadsData.sources.find(source=>source.id==='mndot-iris-incidents'):null;
  const wzdx=/\b(NJ|NC|MO|AZ), USA$/.test(game.venue.address);
  const timing={matched:context.overlapCount?`${context.overlapCount} published road-event ${context.overlapCount===1?'window overlaps':'windows overlap'} the illustrative interval from four hours before to five hours after kickoff. Overlap is a review cue, not evidence of route or event impact.`:'No published timed road-event window in this snapshot overlaps the illustrative kickoff interval. Agency-listed incidents and closures without end times cannot be matched to kickoff.',no_coverage:'No connected agency road-condition feed for this venue; event-time matching is unavailable.',stale:'Snapshot is more than 12 hours old; event-time matching is disabled.',cancelled:'Game is cancelled in source; event-time matching is disabled.',kickoff_tbd:'Kickoff time is TBD; event-time matching is disabled.',past_or_invalid:'Kickoff is past or invalid; current road data is not matched to this game.',source_listed_only:context.records.length?wzdx?'Publisher-listed WZDx work zones are nearby spatial context; published dates are not verified as active work at kickoff.':mnSource?'MnDOT IRIS lists current roadway incidents near the venue candidate point. The snapshot does not establish whether any will remain active at kickoff.':'Tennessee SmartWay events are source-listed road context. Open-ended and recurring records are not matched to kickoff.':wzdx?'The WZDx feed returned no qualifying nearby work zones in this snapshot; road conditions cannot be inferred from that absence.':mnSource?'The MnDOT IRIS feed returned no nearby active roadway incidents in this snapshot; road conditions cannot be inferred from that absence.':'Tennessee SmartWay query returned no qualifying nearby records in this snapshot; road conditions cannot be inferred from that absence.',outside_window:'Kickoff is outside this source’s published-window comparison period; event-time matching is unavailable.'}[context.timingState];
  target.innerHTML=`<p class="feed-state">AGENCY ROAD CONDITIONS · SNAPSHOT ${esc(fmt(roadsData.builtAt))}${roadsData.directCheck?' · DIRECT TDOT CHECK':''}</p><p>${esc(timing)}${context.timingState==='no_coverage'?'':context.timingState==='source_listed_only'?wzdx?' WZDx records are within 10 km of the unreviewed venue point; verify with the road agency before travel decisions.':` The query is limited to 10 km around the unreviewed venue point; verify with ${mnSource?'MnDOT':'Tennessee DOT'} before travel decisions.`:' Published records are within 10 km of the venue candidate point. Dates and times display in your browser time zone; verify with the road agency before travel decisions.'}${ilSource?.sourceUpdatedAt?' Illinois DOT layer last edited '+esc(fmt(ilSource.sourceUpdatedAt))+'.':''}${wiSource?.sourceUpdatedAt?' WisDOT 511 layer last edited '+esc(fmt(wiSource.sourceUpdatedAt))+'. Recurrence descriptions are not expanded beyond each structured event window.':''}${laSource?.sourceUpdatedAt?' Louisiana DOTD service last updated '+esc(fmt(laSource.sourceUpdatedAt))+'. Historical and undated events are excluded.':''}${mnSource?.sourceUpdatedAt?' MnDOT IRIS feed last modified '+esc(fmt(mnSource.sourceUpdatedAt))+'.':''}</p>${context.records.length?context.records.map(item=>`<div class="camera-row"><strong>${item.overlaps?'<span class="time-match">TIME OVERLAP · REVIEW</span> ':''}${esc(item.kind)} · ${esc(item.name)}</strong><span>${esc(item.agency)} · ${esc(item.distanceKm)} km${item.timed?' · '+esc(fmt(item.startAt))+' to '+esc(fmt(item.endAt)):item.timingPolicy==='source_listed_only'?' · event-time match not assessed':' · no structured event window'}${item.sourceFeatureCount?' · grouped DriveNC source features: '+esc(item.sourceFeatureCount)+'; distinct source windows: '+esc(item.sourceWindowCount):''}${item.sourceRecordDate?' · source record '+esc(item.sourceRecordDate):''}${item.sourceReportedBy?' · source field '+esc(item.sourceReportedBy):''}</span><span>${esc(humanText(item.detail))}</span>${link(item.sourceUrl,'Agency source')}</div>`).join(''):'<p>No nearby road condition records in the connected agency snapshots for this venue.</p>'}${game.venue.id==='3810'&&liveTennesseeRoad?.state==='failed'?'<p>Direct Tennessee DOT check failed; showing the last scheduled snapshot if available. Verify with the agency.</p>':''}${failed.length?`<p>Unavailable source: ${esc(failed.map(source=>humanLabel(source.id)).join(', '))}. Coverage may be incomplete.</p>`:''}`;  appendPhillyPermitPlanning(game,target);
}
async function refreshTennesseeRoad(game){
  if(game.venue.id!=='3810'||selected!==game.id)return;
  const checkedAt=Date.now();
  try{
    const response=await fetch(tennesseeRoadQuery(checkedAt),{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data.features)||data.error||data.exceededTransferLimit||data.features.length>=1000)throw Error('Incomplete Tennessee DOT response');
    const seasonEnd=Math.max(...snapshot.games.map(item=>Date.parse(item.kickoff)).filter(Number.isFinite));
    const records=parseTennesseeRoadEvents(data.features,checkedAt,seasonEnd,tennesseeRoadLayer).map(item=>({...item,distanceKm:Math.round(distance(game.venue.lat,game.venue.lon,item.lat,item.lon)*10)/10})).filter(item=>item.distanceKm<=10).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,50);
    if(selected!==game.id)return;
    const base=roadSnapshot||{sources:[],byVenue:{},timedCoverageByVenue:{}};
    const snapshotAt=new Date(checkedAt).toISOString();
    liveTennesseeRoad={state:'ok',checkedAt,snapshot:{...base,builtAt:snapshotAt,directCheck:{sourceUrl:tennesseeRoadLayer,checkedAt:snapshotAt},sources:[...base.sources.filter(source=>source.id!=='tdot-smartway-nashville'),{id:'tdot-smartway-nashville',url:tennesseeRoadLayer,status:'ok',records:records.length}],byVenue:{...base.byVenue,['3810']:records},timedCoverageByVenue:{...base.timedCoverageByVenue,['3810']:{from:null,through:null,sourceListedOnly:true}}}};
  }catch(error){if(selected!==game.id)return;liveTennesseeRoad={state:'failed',checkedAt,error:String(error)}}
  renderRoads(game);renderBrief(game);
}
async function refreshCmpdOpenTraffic(game){
  if(game.venue.id!=='3628'||selected!==game.id)return;
  const target=$('cmpd-open-traffic');if(!target)return;
  try{
    const response=await fetch(cmpdOpenTrafficFeed,{headers:{Accept:'application/georss+xml, application/xml'},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const xml=await response.text(),checkedAt=Date.now();
    const context=summarizeCmpdOpenTraffic(parseCmpdOpenTrafficXml(xml),game.venue,checkedAt);
    if(selected!==game.id)return;
    cmpdTraffic=context;renderBrief(game);
    target.innerHTML=`<p class="feed-state">CMPD OPEN ROADWAY FEED · CHECKED ${esc(fmt(checkedAt))}</p><p>${esc(context.nearby)} of ${esc(context.totalOpen)} publisher-listed open crashes, traffic-control malfunctions or obstructions have approximate points within 5 km of the unreviewed Bank of America Stadium point.${context.state==='partial'?' '+esc(context.invalidCount)+' entries could not be screened, so this count is incomplete.':''}${context.newestNearbyAt?' Newest nearby publication: '+esc(fmt(context.newestNearbyAt))+'.':''}</p><p>This is a current feed check, not a police alert, verified route impact, stadium incident, or threat finding. Individual incident titles, addresses and points are discarded after counting. ${link(cmpdOpenTrafficFeed,'CMPD open roadway source')}</p>`;
  }catch(error){if(selected!==game.id)return;cmpdTraffic={state:'failed',checkedAt:Date.now()};renderBrief(game);target.innerHTML=`<p>CMPD open roadway feed unavailable or invalid (${esc(error.message)}). No negative finding can be inferred. ${link(cmpdOpenTrafficFeed,'CMPD source')}</p>`}
}
async function refreshMbtaAlerts(game){
  if(game.venue.id!=='3738'||selected!==game.id)return;
  const target=$('transit-alerts');if(!target)return;
  try{
    const response=await fetch(mbtaFoxboroAlertsUrl,{headers:{Accept:'application/vnd.api+json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const context=summarizeMbtaFoxboroAlerts(await response.json(),game,Date.now());
    if(selected!==game.id)return;
    mbtaTransit=context;renderBrief(game);
    target.innerHTML=`<p class="feed-state">MBTA FOXBORO STATION ALERTS · CHECKED ${esc(fmt(context.checkedAt))}</p><p>${esc(context.totalReturned)} station-filtered alert${context.totalReturned===1?'':'s'} returned.${context.screenable?' '+esc(context.overlapCount)+' published active period'+(context.overlapCount===1?'':'s')+' overlap the illustrative event window.':' Event-time screening unavailable for this game.'}${context.state==='partial'?' This response is incomplete or contains invalid records.':''}</p>`+
      context.alerts.slice(0,5).map(item=>`<div class="camera-row"><strong>${item.eventWindowOverlap?'EVENT-TIME OVERLAP · REVIEW · ':''}${esc(item.header)}</strong><span>${esc(humanLabel(item.effect))} · ${esc(item.lifecycle)} · ${item.periods.map(period=>`${esc(fmt(period.start))} to ${period.end?esc(fmt(period.end)):'open-ended in source'}`).join('; ')}</span>${link(item.sourceUrl,'MBTA alert record')}</div>`).join('')+
      (context.totalReturned>5?`<p>Showing five alert records here. ${esc(context.omittedAlertCount)} valid records exceed the 30-record evidence export limit. Consult the source for all returned records.</p>`:'')+
      `<p>Foxboro station is about 0.5 km from the unreviewed Gillette Stadium point. These are transit service notices; even a time overlap does not establish event-train impact, stadium access disruption, or a threat. Confirm service and travel plans with MBTA. ${link(mbtaFoxboroAlertsUrl,'MBTA stop-filtered feed')}</p>`;
  }catch(error){if(selected!==game.id)return;mbtaTransit={state:'failed',checkedAt:Date.now()};renderBrief(game);target.innerHTML=`<p>MBTA Foxboro station alerts unavailable or invalid (${esc(error.message)}). No negative transit finding can be inferred. ${link(mbtaFoxboroAlertsUrl,'MBTA feed')}</p>`}
}
async function refreshMbtaSchedules(game){
  if(game.venue.id!=='3738'||selected!==game.id)return;
  const target=$('transit-schedule');if(!target)return;
  if(mbtaSchedule?.state==='retrieved'&&Date.now()-mbtaSchedule.checkedAt<30*60000)return;
  let sourceUrl;
  try{
    sourceUrl=mbtaFoxboroSchedulesUrl(game);
    const response=await fetch(sourceUrl,{headers:{Accept:'application/vnd.api+json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const context=summarizeMbtaFoxboroSchedules(await response.json(),game,Date.now());
    if(selected!==game.id)return;
    mbtaSchedule=context;renderBrief(game);
    target.innerHTML=`<p class="feed-state">MBTA FOXBORO PUBLISHED SCHEDULE · SERVICE DATE ${esc(context.serviceDate)} · CHECKED ${esc(fmt(context.checkedAt))}</p><p>${esc(context.totalReturned)} station schedule entr${context.totalReturned===1?'y':'ies'} returned; ${esc(context.arrivalCount)} with arrival times, ${esc(context.departureCount)} with departure times.${context.state==='partial'?' Response incomplete or contains invalid records.':''}</p>`+
      context.entries.slice(0,8).map(item=>`<div class="camera-row"><strong>${esc(item.headsign||'MBTA commuter rail trip')}</strong><span>${item.arrivalAt?'Arrival '+esc(fmt(item.arrivalAt)):''}${item.arrivalAt&&item.departureAt?' · ':''}${item.departureAt?'Departure '+esc(fmt(item.departureAt)):''}</span>${link(item.sourceUrl,'MBTA trip record')}</div>`).join('')+
      (context.totalReturned>8?`<p>Showing eight of ${esc(context.totalReturned)} returned entries; ${esc(context.omittedEntryCount)} valid entries exceed the 30-entry evidence export limit. Consult the source for the full schedule.</p>`:'')+
      `<p>These are published station times, not live train positions or a guarantee of operation. A missing postgame departure time in this response does not mean no return service. ${link(sourceUrl,'MBTA game-date station schedule')}</p>`;
  }catch(error){if(selected!==game.id)return;mbtaSchedule={state:'failed',checkedAt:Date.now()};renderBrief(game);target.innerHTML=`<p>MBTA Foxboro game-date schedule unavailable or invalid (${esc(error.message)}). No service conclusion can be inferred. ${link(sourceUrl||'https://api-v3.mbta.com/schedules','MBTA schedules')}</p>`}
}
async function refreshMbtaPredictions(game){
  if(game.venue.id!=='3738'||selected!==game.id)return;
  const target=$('transit-predictions');if(!target)return;
  try{
    const response=await fetch(mbtaFoxboroPredictionsUrl,{headers:{Accept:'application/vnd.api+json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const context=summarizeMbtaFoxboroPredictions(await response.json(),Date.now());
    if(selected!==game.id)return;
    mbtaPredictions=context;renderBrief(game);
    target.innerHTML=`<p class="feed-state">MBTA FOXBORO CURRENT PREDICTIONS · CHECKED ${esc(fmt(context.checkedAt))}</p><p>${esc(context.totalReturned)} current prediction record${context.totalReturned===1?'':'s'} returned.${context.state==='partial'?' Response incomplete or contains invalid records.':''}</p>`+
      context.entries.slice(0,8).map(item=>`<div class="camera-row"><strong>${esc(item.headsign||'MBTA commuter rail trip')}</strong><span>${item.arrivalAt?'Predicted arrival '+esc(fmt(item.arrivalAt)):''}${item.arrivalAt&&item.departureAt?' · ':''}${item.departureAt?'Predicted departure '+esc(fmt(item.departureAt)):''}${item.status?' · '+esc(humanLabel(item.status)):''}</span>${link(item.sourceUrl,'MBTA trip record')}</div>`).join('')+
      `<p>Predictions are estimates for station service now; zero records do not mean the game train is cancelled or that no later service will run. No train position or venue impact is inferred. ${link(context.sourceUrl,'MBTA current predictions')}</p>`;
  }catch(error){if(selected!==game.id)return;mbtaPredictions={state:'failed',checkedAt:Date.now()};renderBrief(game);target.innerHTML=`<p>MBTA Foxboro predictions unavailable or invalid (${esc(error.message)}). No service conclusion can be inferred. ${link(mbtaFoxboroPredictionsUrl,'MBTA predictions')}</p>`}
}
function renderTransit(game){
  const target=$('transit');if(!target)return;
  if(game.venue.id==='3806'){
    const context=selectSeptaForGame(game,septaSnapshot);
  target.innerHTML=`<p class="feed-state">SEPTA B LINE · ${esc(humanLabel(context.state))}${context.sourceAt?' · SOURCE '+esc(fmt(context.sourceAt)):''}</p><p>${context.state==='current snapshot'||context.state==='partial'?`${esc(context.matchingCount)} B Line or NRG stop alert${context.matchingCount===1?'':'s'} in the publisher snapshot; ${context.screenable?esc(context.overlapCount)+' overlap the illustrative event window.':'game-time screening unavailable.'}`:'The published alert snapshot is unavailable or stale; no service conclusion can be inferred.'} ${link(septaAlertsPage,'SEPTA alerts')}</p>${context.alerts.filter(item=>item.eventWindowOverlap).slice(0,8).map(item=>`<div class="camera-row"><strong>${esc(item.header)}</strong><span>${esc(item.scope)} · ${esc(humanLabel(item.effect||'effect not supplied'))} · event-window overlap</span>${link(item.sourceUrl,'SEPTA alerts')}</div>`).join('')}<p>Route-wide notices do not establish an NRG Station issue. These are service notices, not verified stadium impacts or threats.</p>`;
    return;
  }
  if(game.venue.id==='3839'){const context=selectNjTransitRailForGame(game,njTransitRailSnapshot);target.innerHTML=`<p class="feed-state">NJ TRANSIT RAIL · ${esc(humanLabel(context.state))}</p>${context.advisories.map(item=>`<div class="camera-row"><strong>${esc(humanText(item.title))}</strong>${link(item.url,'NJ TRANSIT advisory')}</div>`).join('')}${(context.regionalAdvisories||[]).map(item=>`<div class="camera-row"><strong>Regional schedule advisory</strong><span>${esc(humanText(item.title))}</span>${link(item.url,'NJ TRANSIT notice')}</div>`).join('')}<p>${context.advisories.length?'Publisher event rail-service planning; confirm the linked notice before travel.':'No exact-game advisory is available in the current snapshot.'} Regional notices apply to the wider rail network and need trip-specific confirmation. This does not verify train operation, disruption, stadium access impact, or a threat. ${link(njTransitRailPage,'NJ TRANSIT status')}</p>`;return}
  if(game.venue.id!=='3738'){target.innerHTML='<p>No station-specific transit alert connector is configured for this venue.</p>';return}
  target.innerHTML='<div id="transit-alerts"><p>Checking MBTA Foxboro station alerts…</p></div><div id="transit-schedule"><p>Checking game-date station schedule…</p></div><div id="transit-predictions"><p>Checking current station predictions…</p></div>';
  refreshMbtaAlerts(game);refreshMbtaSchedules(game);refreshMbtaPredictions(game);
  transitRefreshTimer=setInterval(()=>{if(selected===game.id){refreshMbtaAlerts(game);refreshMbtaSchedules(game);refreshMbtaPredictions(game)}else{clearInterval(transitRefreshTimer);transitRefreshTimer=null}},300000);
}
function renderPublicSafety(game){
  const target=$('public-safety');
  if(publicSafetyRefreshTimer){clearInterval(publicSafetyRefreshTimer);publicSafetyRefreshTimer=null}
  if(game.venue.id==='3673'){
    async function refreshSeattle(){
      try{
        const checkedAt=Date.now(),queries=seattleCallQueries(game.venue,checkedAt);
        const [count,latest]=await Promise.all([json(queries.countUrl),json(queries.latestUrl)]);
        if(selected!==game.id)return;
        const context=summarizeSeattleCalls(count,latest,checkedAt);
        briefPolice={state:'retrieved',checkedAt,context,sourceId:'seattle'};renderBrief(game);
        target.innerHTML=`<p class="feed-state">SEATTLE POLICE CLOSED CAD RESPONSES · CHECKED ${esc(fmt(checkedAt))}</p><p>${esc(context.nearby)} public call ID${context.nearby===1?'':'s'} returned within 5 km of the unreviewed Lumen Field point and the preceding 12 hours. Latest source call time ${esc(fmt(context.newestUpdate))}.</p><p>The city publishes responses after closure, as close to real time as possible. These are dispatched calls, not active police alerts, confirmed crimes, incidents at the stadium, or threats. The count is a geographic context observation; no call identifiers, addresses, types, or locations are shown or retained. ${link(seattleCallsViewer,'Seattle Police public map')} · ${link(seattleCallsLayer,'City data layer')}</p>`;
      }catch(error){if(selected===game.id){briefPolice={state:'failed',sourceId:'seattle'};renderBrief(game);target.innerHTML=`<p>Seattle Police calls-for-service check unavailable or stale (${esc(error.message)}). No negative finding can be inferred. ${link(seattleCallsViewer,'City public map')}</p>`}}
    }
    target.innerHTML='<p>Checking Seattle Police’s public calls-for-service layer…</p>';
    refreshSeattle();
    publicSafetyRefreshTimer=setInterval(()=>{if(selected===game.id)refreshSeattle();else{clearInterval(publicSafetyRefreshTimer);publicSafetyRefreshTimer=null}},300000);
    return;
  }
  if(game.venue.id==='3933'){
    async function refreshChicago(){
      try{
        const checkedAt=Date.now(),query=chicagoCrimeQuery(game.venue,checkedAt);
        const response=await json(query.url);
        if(selected!==game.id)return;
        const context=summarizeChicagoCrimes(response,query,checkedAt);
        briefPolice={state:'retrieved',checkedAt,context,sourceId:'chicago'};renderBrief(game);
        target.innerHTML=`<p class="feed-state">CHICAGO POLICE REPORTED-CRIME DATA · CHECKED ${esc(fmt(checkedAt))}</p><p>${esc(context.nearby)} geocoded public records within 5 km of the unreviewed Soldier Field point, dated ${esc(context.start)} through the day before ${esc(context.end)}. The 30-day window ends eight days before the current UTC date.</p><p>This is a delayed, potentially incomplete historical count, not a current incident feed, police alert, comparison over time, stadium incident, or threat finding. Records without usable coordinates are absent from this count. The city warns against time comparisons and notes past missing location values. No individual record, address, or location is shown or retained. ${link(chicagoCrimeDataset,'City dataset')} · ${link('https://data.cityofchicago.org/stories/s/Problem-Crime-Datasets-Missing-Location-Values-10-/ragt-xajb/','Location-data notice')}</p>`;
      }catch(error){if(selected===game.id){briefPolice={state:'failed',sourceId:'chicago'};renderBrief(game);target.innerHTML=`<p>Chicago delayed crime aggregate unavailable (${esc(error.message)}). No negative finding can be inferred. ${link(chicagoCrimeDataset,'City dataset')}</p>`}}
    }
    target.innerHTML='<p>Checking Chicago’s delayed public crime aggregate…</p>';
    refreshChicago();
    publicSafetyRefreshTimer=setInterval(()=>{if(selected===game.id)refreshChicago();else{clearInterval(publicSafetyRefreshTimer);publicSafetyRefreshTimer=null}},300000);
    return;
  }
  if(game.venue.id==='3970'){
    const feed=glendalePoliceSnapshot,context=feed?.byVenue?.['3970'],checkedAt=Date.parse(feed?.builtAt);
    if(feed?.status!=='ok'||!context||context.status!=='delayed_historical'||context.zip!=='85305'||!Number.isFinite(checkedAt)||Date.now()-checkedAt>12*3600000||checkedAt>Date.now()+60000){
      briefPolice={state:'failed',sourceId:'glendale'};renderBrief(game);
      target.innerHTML=`<p>Glendale Police historical ZIP call aggregate is loading, stale, or unavailable. No negative finding can be inferred. ${link(glendaleCallsViewer,'Police public data viewer')}</p>`;
      return;
    }
    briefPolice={state:'retrieved',sourceId:'glendale',checkedAt,context};renderBrief(game);
    target.innerHTML=`<p class="feed-state">GLENDALE POLICE DELAYED PUBLIC CALL AGGREGATE · BUILT ${esc(fmt(feed.builtAt))}</p><p>${esc(context.nearby)} public calls-for-service records in ZIP 85305, dated ${esc(context.start)} through the day before ${esc(context.end)}. State Farm Stadium uses this ZIP, but the ZIP covers a broader area. The latest citywide call time was ${esc(fmt(context.sourceLatestAt))}; the city table was loaded ${esc(fmt(context.sourceLoadedAt))}.</p><p>This is a delayed historical count, not an active police alert, a stadium incident, a trend, or a threat. No individual call identifiers, addresses, types, or coordinates are retained. ${link(glendaleCallsViewer,'Police public data viewer')} · ${link(glendaleCallsLayer,'City data table')}</p>`;
    return;
  }
  if(game.venue.id==='3812'){
    const feed=indyPoliceSnapshot,context=feed?.byVenue?.['3812'],checkedAt=Date.parse(feed?.builtAt);
    if(feed?.status!=='ok'||!context||!Number.isFinite(checkedAt)||Date.now()-checkedAt>12*3600000||checkedAt>Date.now()+60000){
      briefPolice={state:'failed',sourceId:'indianapolis'};renderBrief(game);
      target.innerHTML=`<p>Indianapolis Police public call aggregate is loading, stale, or unavailable. No negative finding can be inferred. ${link(indianapolisCfsLayer,'IMPD public data layer')}</p>`;
      return;
    }
    briefPolice={state:'retrieved',sourceId:'indianapolis',checkedAt,context};renderBrief(game);
    target.innerHTML=`<p class="feed-state">INDIANAPOLIS POLICE PUBLIC CALL AGGREGATE · BUILT ${esc(fmt(feed.builtAt))}</p><p>${esc(context.nearby)} public calls-for-service records in a 5 km area around the unreviewed Lucas Oil Stadium point, dated ${esc(context.start)} through the day before ${esc(context.end)}. The newest citywide source record was ${esc(fmt(context.sourceLatestAt))}, ${esc(context.sourceLagHours)} hours before this check.</p><p>This is a delayed historical count, not an active police alert, a stadium incident, a trend, or a threat. The aggregate retains no call identifiers, addresses, types, or coordinates. Publisher completeness and point precision are unverified. ${link(indianapolisCfsLayer,'IMPD public data layer')}</p>`;
    return;
  }
  if(game.venue.id==='3628'){
    const feed=charlottePoliceSnapshot,context=feed?.byVenue?.['3628'],checkedAt=Date.parse(feed?.builtAt);
    if(feed?.status!=='ok'||!context||!Number.isFinite(checkedAt)||Date.now()-checkedAt>12*3600000||checkedAt>Date.now()+60000){
      briefPolice={state:'failed',sourceId:'charlotte'};renderBrief(game);
      target.innerHTML=`<p>Charlotte-Mecklenburg Police historical incident aggregate is loading, stale, or unavailable. No negative finding can be inferred. ${link(charlotteIncidentsLayer,'CMPD public data layer')}</p>`;
    }else{
    briefPolice={state:'retrieved',sourceId:'charlotte',checkedAt,context};renderBrief(game);
    target.innerHTML=`<p class="feed-state">CHARLOTTE-MECKLENBURG POLICE INCIDENT AGGREGATE · BUILT ${esc(fmt(feed.builtAt))}</p><p>${esc(context.nearby)} public incident reports, including criminal and noncriminal reports, in a 5 km area around the unreviewed Bank of America Stadium point, dated ${esc(context.start)} through the day before ${esc(context.end)}. The newest citywide source report date was ${esc(fmt(context.sourceLatestAt))}, ${esc(context.sourceLagHours)} hours before this check.</p><p>This is a delayed historical count, not an active police alert, a confirmed crime total, a stadium incident, a trend, or a threat. Reports may include unfounded cases. The aggregate retains no report identifiers, addresses, types, or coordinates. Publisher completeness and point precision are unverified. ${link(charlotteIncidentsLayer,'CMPD public data layer')}</p>`;
    }
    target.insertAdjacentHTML('beforeend','<div id="cmpd-open-traffic"><p>Checking CMPD currently open roadway incidents…</p></div>');
    refreshCmpdOpenTraffic(game);
    publicSafetyRefreshTimer=setInterval(()=>{if(selected===game.id)refreshCmpdOpenTraffic(game);else{clearInterval(publicSafetyRefreshTimer);publicSafetyRefreshTimer=null}},300000);
    return;
  }
  if(game.venue.id==='3937'){
    const feed=denverPoliceSnapshot,context=feed?.byVenue?.['3937'],checkedAt=Date.parse(feed?.builtAt);
    if(feed?.status!=='ok'||!context||!Number.isFinite(checkedAt)||Date.now()-checkedAt>12*3600000||checkedAt>Date.now()+60000){
      briefPolice={state:'failed',sourceId:'denver'};renderBrief(game);
      target.innerHTML=`<p>Denver Open Data historical reported-offense aggregate is loading, stale, or unavailable. No negative finding can be inferred. ${link(denverCrimeLayer,'Denver Open Data layer')}</p>`;
      return;
    }
    briefPolice={state:'retrieved',sourceId:'denver',checkedAt,context};renderBrief(game);
    target.innerHTML=`<p class="feed-state">DENVER REPORTED-OFFENSE AGGREGATE · BUILT ${esc(fmt(feed.builtAt))}</p><p>${esc(context.nearby)} geocoded, crime-flagged public records within 5 km of the unreviewed Empower Field at Mile High point, dated ${esc(context.start)} through the day before ${esc(context.end)}. This 30-day window ends seven days before the current UTC day. The newest citywide source report date was ${esc(fmt(context.sourceLatestAt))}, ${esc(context.sourceLagHours)} hours before this check.</p><p>This delayed historical count is not a current police alert, stadium incident, trend, or threat. Records without usable points are absent. No individual ID, address, category, person, or coordinate is shown or retained. Publisher completeness and the candidate point are unverified. ${link(denverCrimeLayer,'Denver Open Data layer')}</p>`;
    return;
  }
  if(game.venue.id==='3806'){
    briefPolice=null;renderBrief(game);
    const feed=phillyAlertsSnapshot,context=feed?.context,checkedAt=Date.parse(feed?.builtAt);
    if(!['retrieved','partial'].includes(feed?.status)||!context||!Number.isFinite(checkedAt)||Date.now()-checkedAt>2*3600000||checkedAt>Date.now()+60000){
      target.innerHTML=`<p>No connected Philadelphia police incident feed. The City website-wide notice check is loading, stale, or unavailable. No negative finding can be inferred. ${link(phillyCityAlertsUrl,'City alerts API')}</p>`;
      return;
    }
    const entries=context.alerts.map(item=>`<li><strong>${esc(humanText(item.title))}</strong>${item.detail?` — ${esc(humanText(item.detail))}`:''} ${link(item.url,'City notice')}</li>`).join('');
    target.innerHTML=`<p>No connected Philadelphia police incident feed.</p><p class="feed-state">PHILADELPHIA CITYWIDE NOTICES · CHECKED ${esc(fmt(feed.builtAt))}</p><p>${esc(context.totalReturned)} website-wide notice record${context.totalReturned===1?'':'s'} returned by the City endpoint.${context.state==='partial'?` ${esc(context.invalidCount)} record${context.invalidCount===1?'':'s'} had unsupported fields.`:''}</p>${entries?`<ul>${entries}</ul>`:''}<p>These notices have city scope; their relevance to Lincoln Financial Field or an Eagles event is unverified. An empty endpoint response does not rule out alerts on other channels. ${link(phillyCityAlertsUrl,'City alerts API')}</p>`;
    return;
  }
  if(game.venue.id!=='3687'){
    briefPolice=null;
    target.innerHTML='<p>No connected jurisdictional police incident source for this venue. This is a coverage gap, not a finding that no incidents exist.</p>';
    return;
  }
  async function refresh(){
    try{
      const query=arlingtonAggregateQueries(game.venue);
      const [count,latest]=await Promise.all([json(query.countUrl),json(query.latestUrl)]),checkedAt=Date.now();
      if(selected!==game.id)return;
      const context=summarizeArlingtonAggregate(count,latest,checkedAt);
      briefPolice={state:'retrieved',checkedAt,context};renderBrief(game);
      target.innerHTML=`<p class="feed-state">ARLINGTON POLICE PUBLIC LISTING · CHECKED ${esc(fmt(checkedAt))}</p><p>${context.nearby} publisher-visible call${context.nearby===1?'':'s'} within 5 km of the unreviewed AT&amp;T Stadium point. Latest citywide source update: ${esc(fmt(context.sourceLatestAt))}, ${esc(context.sourceLagMinutes)} minutes before this check.</p><p>The city delays calls by at least 60 minutes and refreshes its public display every 15 minutes. Calls may be open or closed, omitted, or changed. This count does not establish a stadium incident, police alert, trend, risk level, or threat. The app requests no incident locations or call details. ${link('https://policeincidents.arlingtontx.gov/','City public viewer')} · ${link(arlingtonPoliceLayer,'City data layer')}</p>`;
    }catch(error){if(selected===game.id){briefPolice={state:'failed'};renderBrief(game);target.innerHTML=`<p>Arlington police incident layer unavailable or incomplete (${esc(error.message)}). No negative finding can be inferred. ${link('https://policeincidents.arlingtontx.gov/','City public viewer')}</p>`}}
  }
  target.innerHTML='<p>Checking Arlington’s delayed public incident layer…</p>';
  refresh();
  publicSafetyRefreshTimer=setInterval(()=>{if(selected===game.id)refresh();else{clearInterval(publicSafetyRefreshTimer);publicSafetyRefreshTimer=null}},300000);
}
let attentionRefreshTimer;
function refreshGameAttention(){
  clearTimeout(attentionRefreshTimer);
  attentionRefreshTimer=setTimeout(()=>{
    const common={...briefInputs(),roads:roadSnapshot};
    for(const key of ['conditions','forecast','police','directGame','roadDirect','cmpdTraffic','transit','transitSchedule','transitPredictions'])delete common[key];
    const badges=new Map([...document.querySelectorAll('[data-attention-game]')].map(b=>[b.dataset.attentionGame,b]));
    for(const game of snapshot.games){
      const badge=badges.get(game.id);
      const summary=game.eventType&&game.eventType!=='nfl'?getAdditionalSummary(game):attentionSummary(buildNflEventPicture(game,game.id===selected?briefInputs():common));geographicSummaries.set(game.id,summary);if(badge){badge.textContent=summary.label;badge.dataset.tone=summary.tone;
      badge.title='Published source screening. Open the game for current checks; absence of a flag is not an all-clear.';}
    }
    renderVenueMap();
  },350);
}
function renderPeopleProtection(picture){
  const target=$('people-protection');if(!target)return;
  const game=snapshot.games.find(game=>game.id===picture.eventId);
  if(game)renderDemoPeople(target,game);
}

function renderAttention(game,picture){
  const summary=attentionSummary(picture);renderEventConcerns(game,summary.items);geographicSummaries.set(game.id,summary);refreshThreatReport();
  const badge=[...document.querySelectorAll('[data-attention-game]')].find(node=>node.dataset.attentionGame===game.id);
  if(badge){badge.textContent=summary.label;badge.dataset.tone=summary.tone;}
  renderEventNotifications($('event-notifications'),game,summary.items);
  const target=$('game-attention');if(!target)return;
  target.innerHTML=`<h4>Threat assessment</h4>${summary.items.length?`<p>${summary.items.length} source concern${summary.items.length===1?'':'s'} require verification. Review the notifications above, map markers and event report for supporting records and decisions.</p>`:`<p class="quiet-state">${summary.screeningState==='pending'?'Source screening has not started. Event conditions are unknown.':'No flagged concerns in the reviewed feed results.'}</p>`}<p class="attention-note">Known high threats have not been established by these feeds. Potential concerns require assessment; supporting records and coverage gaps are in Source feeds.</p>`;
}
function installBriefingNavigation(){
  const detail=$('detail');
  const attention=document.createElement('section');attention.id='game-attention';attention.className='attention-panel';attention.setAttribute('aria-live','polite');
  detail.querySelector('.facts').after(attention);
  const mapPanel=document.createElement('section');mapPanel.className='event-map-panel';
  mapPanel.innerHTML='<h4>Stadium & surrounding area</h4><div class="event-map-actions"><button id="map-show-stadium" type="button">Stadium view</button><button id="map-show-airspace" type="button">Show full airspace</button></div><div id="event-geographic-map" aria-label="Street map with stadium and FAA airspace overlays"></div><p id="event-map-status" role="status">Loading map layers…</p><p id="event-map-tile-status" role="status"></p>';
  attention.before(mapPanel);
  const notices=document.createElement('section');notices.id='event-notifications';notices.className='attention-panel';mapPanel.after(notices);
  const peoplePanel=document.createElement('section');peoplePanel.id='people-protection';peoplePanel.className='attention-panel';attention.after(peoplePanel);
  detail.querySelectorAll(':scope > .detail-section').forEach((section,index)=>{
    const disclosure=document.createElement('details');disclosure.className='source-drilldown';disclosure.id=`brief-section-${index}`;
    const title=document.createElement('summary');title.textContent=section.querySelector('h4').textContent;
    section.before(disclosure);disclosure.append(title,section);section.querySelector('h4').hidden=true;
  });
}

function selectGame(id){stopDemoTracking();stopDemoReplay();stopPublicEventMonitor();stopMovementTracking();clearInterval(directGameRefreshTimer);directGameRefreshTimer=null;directGameRequestSerial++;clearInterval(seattleFireRefreshTimer);seattleFireRefreshTimer=null;seattleFireRequestSerial++;clearInterval(nashvillePoliceRefreshTimer);nashvillePoliceRefreshTimer=null;nashvillePoliceRequestSerial++;directGame=null;clearInterval(exercisePlaybackTimer);exercisePlaybackTimer=null;clearInterval(transitRefreshTimer);transitRefreshTimer=null;selected=id;exerciseStage=0;briefConditions=null;briefForecast=null;briefPolice=null;cmpdTraffic=null;mbtaTransit=null;mbtaSchedule=null;mbtaPredictions=null;liveTennesseeRoad=null;if(tennesseeRoadRefreshTimer){clearInterval(tennesseeRoadRefreshTimer);tennesseeRoadRefreshTimer=null}if(briefRefreshTimer)clearInterval(briefRefreshTimer);if(conditionsRefreshTimer)clearInterval(conditionsRefreshTimer);conditionsRequestSerial++;renderList();const game=snapshot.games.find(item=>item.id===id);if(!game)return;setEventNavigation(game,geographicExplorer?.eventTrail(game)||[]);if(game.eventType&&game.eventType!=='nfl'){geographicSummaries.set(game.id,getAdditionalSummary(game));renderAdditionalEvent($('detail'),game,geographicSummaries,()=>{refreshGameAttention();refreshThreatReport();});return;}const venue=game.venue,point=Number.isFinite(venue.lat)&&Number.isFinite(venue.lon);$('venue-map')?.querySelectorAll('.map-marker').forEach(button=>button.classList.toggle('selected',button.dataset.venueId===venue.id));$('detail').innerHTML=`<span class="tag">WEEK ${game.week} · ${esc(humanLabel(game.status))}</span><h3>${esc(game.title)}</h3><p class="detail-sub">${esc(gameTime(game))}</p>${gameStateText(game)?`<p class="detail-sub">ESPN scoreboard snapshot: ${esc(gameStateText(game))}. Retrieved ${esc(fmt(game.sourceRetrievedAt))}; confirm current game state with the publisher. Score and period do not establish venue impact or a threat.</p>`:''}<div class="facts">${fact('VENUE',venue.name)}${fact('LOCATION',venue.address)}${fact('MAP POINT',point?venue.lat.toFixed(5)+', '+venue.lon.toFixed(5):'Not verified')}</div><div class="detail-section"><h4>Schedule & venue provenance</h4><p>ESPN scoreboard ID ${esc(game.id)}. Retrieved ${esc(fmt(game.sourceRetrievedAt))}. Game and venue may change; confirm with the NFL or host club.</p><p>Venue coordinate: ${esc(humanLabel(venue.coordinateStatus))}. ${point?'A name match is not an entrance, footprint, or operational asset.':'No point-specific feed is queried for this venue.'}</p>${link(game.sourceUrl,'ESPN game')}${venue.venueCandidateUrl?' · '+link(venue.venueCandidateUrl,'Wikidata venue candidate'):''}</div><div class="detail-section event-picture-section"><h4>Public-source event picture</h4><div id="event-picture"><p>Assembling source status…</p></div></div><div class="detail-section"><h4>Stadium outline — source details</h4><div id="ground"><p>Loading mapped ground geometry…</p></div></div><div class="detail-section"><h4>FAA airspace — source details</h4><div id="airspace"><p>Loading FAA SEAMS…</p></div></div><div class="detail-section"><h4>FAA TFR and NOTAM review</h4><div id="tfr"><p>Loading FAA TFR list…</p></div></div><div class="detail-section"><h4>Public conditions</h4><p>NWS alerts, nearby station observations and USGS reports are rechecked about every five minutes while this game is open. A failed check is shown as unavailable.</p><button id="conditions-refresh" type="button">Check public conditions now</button><div id="conditions"><p>Loading current public feeds…</p></div></div><div class="detail-section"><h4>NOAA severe-weather outlook</h4><div id="spc"><p>Loading Day 1–3 forecast context…</p></div></div><div class="detail-section"><h4>NOAA excessive-rainfall outlook</h4><div id="wpc-rain"><p>Loading Day 1–3 rainfall context…</p></div></div><div class="detail-section"><h4>Public safety activity</h4><div id="public-safety"><p>Checking jurisdictional coverage…</p></div></div><div class="detail-section"><h4>Transit alerts and published service</h4><div id="transit"><p>Checking station coverage…</p></div></div><div class="detail-section"><h4>Roadway camera sources</h4><div id="cameras"><p>Loading camera metadata…</p></div></div><div class="detail-section"><h4>Road conditions</h4><div id="roads"><p>Loading agency road conditions…</p></div></div><div class="detail-section"><h4>511NJ MetLife event and roads</h4><div id="nj511"><p>Loading 511NJ source status…</p></div></div>`;installBriefingNavigation();renderEventMonitoringPlan($('detail'),game);$('detail').querySelector('h3').after(createThreatReportButton(()=>({title:game.title,level:'event',games:[game],summaries:geographicSummaries,changeFeed:publishedChangeFeed,replaySnapshot:getDemoReplaySnapshot(game.id)})));installEventWorkspaceTabs($('detail'));appendDemoOperationalFeeds($('event-view-feeds'),game,{onUpdate:refreshThreatReport});renderGround(game);renderAirspace(game);renderTfr(game);renderSpc(game);renderWpcRain(game);renderCameras(game);renderRoads(game);renderNj511(game);renderPublicSafety(game);renderTransit(game);renderBrief(game);loadDirectGame(game);if(game.venue.id==='3673'){refreshSeattleFireAggregate(game);seattleFireRefreshTimer=setInterval(()=>{if(selected===id&&document.visibilityState==='visible')refreshSeattleFireAggregate(game)},300000)}directGameRefreshTimer=setInterval(()=>{if(selected===id&&document.visibilityState==='visible')loadDirectGame(game)},300000);if(game.venue.id==='3810'){refreshTennesseeRoad(game);tennesseeRoadRefreshTimer=setInterval(()=>{if(selected===id)refreshTennesseeRoad(game)},300000);refreshNashvillePoliceCount(game);nashvillePoliceRefreshTimer=setInterval(()=>{if(selected===id&&document.visibilityState==='visible')refreshNashvillePoliceCount(game)},300000)}briefRefreshTimer=setInterval(()=>{if(selected===id)renderBrief(game)},60000);if(point){$('conditions-refresh').onclick=()=>loadConditions(game,true);loadConditions(game);conditionsRefreshTimer=setInterval(()=>{if(selected===id&&document.visibilityState==='visible'&&(!briefConditions||Date.now()-briefConditions.at>=300000))loadConditions(game)},60000)}else{$('conditions-refresh').disabled=true;$('conditions').innerHTML='<p>Point-specific feeds unavailable because the venue map point has not been verified.</p>'}}
async function refreshSeattleFireAggregate(game){
  if(game?.venue?.id!=='3673')return;
  const serial=++seattleFireRequestSerial;
  lastSeattleFireDirectCheckAt=Date.now();
  const query=seattleFireAggregateQuery();
  try{
    const headers={Accept:'application/json'};
    const [countResponse,metadataResponse]=await Promise.all([fetch(query.url,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)}),fetch(seattleFireMetadataUrl,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)})]);
    if(!countResponse.ok||!metadataResponse.ok||new URL(countResponse.url).origin!=='https://data.seattle.gov'||new URL(metadataResponse.url).origin!=='https://data.seattle.gov')throw Error('City aggregate unavailable');
    const [countRaw,metadataRaw]=await Promise.all([countResponse.text(),metadataResponse.text()]);
    if(countRaw.length>10000||metadataRaw.length>200000)throw Error('City response exceeds bound');
    const result=summarizeSeattleFireAggregate(JSON.parse(countRaw),JSON.parse(metadataRaw),query);
    if(selected!==game.id||serial!==seattleFireRequestSerial)return;
    seattleFireAggregateSnapshot={...result,retrievalMode:'browser_direct'};renderBrief(game);
  }catch{
    if(selected!==game.id||serial!==seattleFireRequestSerial)return;
    seattleFireAggregateSnapshot={schema:'event-atlas.seattle-fire-aggregate.v1',status:'error',checkedAt:new Date().toISOString(),sourceUrl:seattleFireDataset,venueId:'3673',nearbyCount:null};
    renderBrief(game);
  }
}
async function refreshNashvillePoliceCount(game){
  if(game?.venue?.id!=='3810')return;
  const serial=++nashvillePoliceRequestSerial;
  lastNashvillePoliceDirectCheckAt=Date.now();
  try{
    const headers={Accept:'application/json'};
    const [metadataResponse,countResponse]=await Promise.all([fetch(`${nashvillePoliceLayer}?f=pjson`,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)}),fetch(`${nashvillePoliceLayer}/query?f=json&where=1%3D1&returnCountOnly=true`,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)})]);
    if(!metadataResponse.ok||!countResponse.ok||new URL(metadataResponse.url).origin!=='https://services2.arcgis.com'||new URL(countResponse.url).origin!=='https://services2.arcgis.com')throw Error('Nashville aggregate unavailable');
    const [metadataRaw,countRaw]=await Promise.all([metadataResponse.text(),countResponse.text()]);
    if(metadataRaw.length>200000||countRaw.length>10000)throw Error('Nashville aggregate response exceeds bound');
    const result=validateNashvillePoliceCount(JSON.parse(metadataRaw),JSON.parse(countRaw));
    if(selected!==game.id||serial!==nashvillePoliceRequestSerial)return;
    nashvillePoliceCountSnapshot={...result,retrievalMode:'browser_direct'};renderBrief(game);
  }catch{
    if(selected!==game.id||serial!==nashvillePoliceRequestSerial)return;
    nashvillePoliceCountSnapshot={schema:'event-atlas.nashville-police-count.v1',status:'failed',checkedAt:new Date().toISOString(),sourceUpdatedAt:null,activeCount:null,sourceUrl:nashvillePoliceLayer,agencyPageUrl:nashvillePolicePage};
    renderBrief(game);
  }
}
async function loadDirectGame(game){
  const serial=++directGameRequestSerial;
  const result=await fetchSelectedGame(game);
  if(selected!==game.id||serial!==directGameRequestSerial)return;
  directGame=result;renderBrief(game);
}
async function loadConditions(game,force=false){
  if(conditionsPendingFor?.id===game.id&&conditionsPendingFor.serial===conditionsRequestSerial)return;
  const venue=game.venue,target=$('conditions'),id=game.id,key=venue.id,requestSerial=++conditionsRequestSerial,button=$('conditions-refresh');
  conditionsPendingFor={id,serial:requestSerial};if(button){button.disabled=true;button.textContent='Checking public conditions…'}
  try{
  const nwsUrl='https://api.weather.gov/alerts/active?point='+venue.lat+','+venue.lon;
  let result=cache.get(key);
  if(force||!result||Date.now()-result.at>=300000){
    const usgs='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
    const responses=await Promise.allSettled([json(nwsUrl,12000),json(usgs,12000),fetchNwsStationObservation(venue)]);
    const nws=responses[0].status==='fulfilled'?responses[0].value:null;
    result={at:Date.now(),alerts:Array.isArray(nws?.features)?nws:null,
      alertsError:responses[0].status==='rejected'?String(responses[0].reason):!Array.isArray(nws?.features)?'Invalid NWS alert response':null,
      quakes:responses[1].status==='fulfilled'?responses[1].value:null,
      quakesError:responses[1].status==='rejected'?String(responses[1].reason):null,
      observation:responses[2].status==='fulfilled'?responses[2].value:{state:'unavailable_or_stale',reason:'NWS station check failed'}};
    if(selected===id&&requestSerial===conditionsRequestSerial)cache.set(key,result);
  }
  if(selected!==id||requestSerial!==conditionsRequestSerial)return;
  briefConditions=result;renderBrief(game);
  const weather=selectWeatherContext(game,result.alerts?.features,result.at);
  const usgsContext=selectUsgsForGame(game,result),quakes=usgsContext.events;
  const weatherNote=weather.state==='stale'?'Alert retrieval is older than five minutes; game-time screening is disabled.':
    weather.state==='kickoff_unavailable'?'Kickoff is TBD, the illustrative game interval has passed, or the game is cancelled in source; game-time screening is disabled.':
    weather.candidateCount?`${weather.candidateCount} NWS severe or extreme alert(s) with immediate or expected urgency overlap the illustrative game interval. Analyst review is required; this is not a threat assessment.`:
    weather.alerts.length?'No returned alert met the game-time screening criteria. This does not establish the absence of hazards or threats.':'No active alert returned for the venue candidate point. This does not establish the absence of hazards or threats.';
  target.innerHTML=`<p class="feed-state">NWS ACTIVE ALERTS · ${result.alertsError?'UNAVAILABLE':'RETRIEVED '+esc(fmt(result.at))}</p>`+
    (result.alertsError?`<p>${esc(result.alertsError)}. No negative finding can be inferred.</p>`:
      `<p>${esc(weatherNote)} NWS alerts are queried for the venue candidate point; confirm footprint and validity with NWS. ${link(nwsUrl,'NWS point feed')}</p>`+
      weather.alerts.map(({feature:item,candidate})=>`<div class="alert"><strong>${candidate?'<span class="time-match">TIME-ALIGNED NWS ALERT · REVIEW</span> ':''}${esc(item.properties?.event||'Alert')}</strong><br>${esc(item.properties?.severity||'Severity not supplied')} · ${esc(item.properties?.urgency||'Urgency not supplied')} · ${item.properties?.effective?esc(fmt(item.properties.effective)):'start not supplied'} to ${item.properties?.ends||item.properties?.expires?esc(fmt(item.properties.ends||item.properties.expires)):'end not supplied'} · ${link(item.properties?.['@id']||item.id,'NWS source')}</div>`).join(''))+
    `<p class="feed-state">NWS NEARBY STATION · ${result.observation?.state==='current_station_observation'?'OBSERVED '+esc(fmt(result.observation.observedAt)):'UNAVAILABLE OR STALE'}</p>`+
    (result.observation?.state==='current_station_observation'?`<p>${esc(result.observation.stationName)} · ${esc(result.observation.distanceKm)} km from venue candidate point · ${esc(result.observation.description||'description unavailable')} · ${result.observation.temperatureC==null?'temperature unavailable':esc(result.observation.temperatureC)+' °C'} · ${result.observation.windKmh==null?'wind unavailable':esc(result.observation.windKmh)+' km/h'} · ${result.observation.humidityPercent==null?'humidity unavailable':esc(result.observation.humidityPercent)+'% relative humidity'}. ${link(result.observation.sourceUrl,'Timestamped NWS record')}</p><p>Nearby station reading, not a stadium measurement or event impact.</p>`:`<p>${esc(result.observation?.reason||'Current station reading unavailable')}. No current venue condition can be inferred.</p>`)+
    `<p class="feed-state">USGS EARTHQUAKES · ${['current_snapshot','partial_source_data'].includes(usgsContext.state)?(usgsContext.invalidCount?'PARTIAL SOURCE DATA · ':'')+'RETRIEVED '+esc(fmt(usgsContext.asOf))+' · PAST SEVEN DAYS':'UNAVAILABLE OR NOT SCREENED'}</p>`+
    (!['current_snapshot','partial_source_data'].includes(usgsContext.state)?`<p>Current bounded USGS context unavailable. ${link(usgsContext.sourceUrl,'USGS feed')}</p>`:quakes.length?quakes.map(item=>`<p>${esc(humanText(item.title))} · magnitude ${esc(item.magnitude)} · ${esc(item.distanceKm)} km from candidate venue point · occurred ${esc(fmt(item.occurredAt))} · ${link(item.sourceUrl,'USGS record')}</p>`).join(''):usgsContext.invalidCount?'<p>No usable nearby record could be selected from this incomplete source sample. Verify the USGS feed directly.</p>':'<p>No magnitude 2.5+ event returned within 250 km in this bounded weekly sample. This is not an all-clear.</p>')+
    '<div id="forecast"><p>Checking the NWS hourly forecast window…</p></div>';
  loadForecast(game,requestSerial);
  }finally{if(conditionsPendingFor?.serial===requestSerial)conditionsPendingFor=null;if(selected===id&&requestSerial===conditionsRequestSerial&&button){button.disabled=false;button.textContent='Check public conditions now'}}
}
async function loadForecast(game,requestSerial){
  if(selected!==game.id||requestSerial!==conditionsRequestSerial)return;
  const target=$('forecast'),venue=game.venue,kickoff=Date.parse(game.kickoff),hours=(kickoff-Date.now())/3600000,active=game.status==='in progress in source'&&hours<=0&&hours>=-9;
  if(game.timeTbd||!active&&(hours<0||hours>168)){
    briefForecast=null;renderBrief(game);
    target.innerHTML=game.timeTbd?'<p class="feed-state">KICKOFF FORECAST · TIME TBD</p><p>Forecast matching starts when a kickoff time is published.</p>':'<p class="feed-state">HOURLY FORECAST · OUTSIDE WINDOW</p><p>The listed kickoff is outside the supported forecast interval. Check NWS directly for current conditions.</p>';
    return;
  }
  try{
    const point=await json('https://api.weather.gov/points/'+venue.lat+','+venue.lon),url=point.properties?.forecastHourly;
    if(!url||new URL(url).origin!=='https://api.weather.gov')throw Error('NWS hourly link unavailable');
    const targetAt=active?Date.now():kickoff;
    const forecast=await json(url),period=forecast.properties?.periods?.find(item=>Date.parse(item.startTime)<=targetAt&&targetAt<Date.parse(item.endTime));
    if(selected!==game.id||requestSerial!==conditionsRequestSerial)return;
    briefForecast={state:'ok',checkedAt:Date.now(),kickoff:game.kickoff,sourceUrl:url,period};
    const selectedForecast=active?selectEventHourForecast(game,briefForecast):selectKickoffForecast(game,briefForecast);
    if(!['current forecast','current event-hour forecast'].includes(selectedForecast.state))briefForecast={state:'failed',kickoff:game.kickoff};
    renderBrief(game);
    target.innerHTML=['current forecast','current event-hour forecast'].includes(selectedForecast.state)?`<p class="feed-state">${active?'EVENT-HOUR':'KICKOFF'} FORECAST · NWS HOURLY</p><p>${esc(selectedForecast.period.shortForecast)} · ${selectedForecast.period.temperature==null?'Temperature not supplied':esc(selectedForecast.period.temperature)+'°'+esc(selectedForecast.period.temperatureUnit||'')} · Wind ${esc(selectedForecast.period.windSpeed||'not supplied')} ${esc(selectedForecast.period.windDirection||'')} · Precipitation ${selectedForecast.period.precipitationPercent==null?'not supplied':esc(selectedForecast.period.precipitationPercent)+'%'}</p><p>${link(url,'NWS forecast')} · Forecast may change; this is not an observed condition.</p>`:`<p>NWS supplied no valid hourly period covering the ${active?'current event hour':'listed kickoff'}.</p>`;
  }catch(error){
    if(selected===game.id&&requestSerial===conditionsRequestSerial){briefForecast={state:'failed',kickoff:game.kickoff};renderBrief(game);target.innerHTML=`<p class="feed-state">HOURLY FORECAST · UNAVAILABLE</p><p>${esc(error.message)}</p>`}
  }
}
async function refreshPublishedSnapshots(){
  if(!snapshot||publicationRefreshPending||Date.now()-lastPublicationCheckAt<300000)return;
  publicationRefreshPending=true;lastPublicationCheckAt=Date.now();
  const feeds=[
    {id:'schedule',file:'nfl.json',key:'games',get:()=>snapshot,set:value=>{snapshot={...value,games:[...value.games,...eventExamples]}}},
    {id:'ground',file:'ground_footprints.json',key:'byVenue',get:()=>groundSnapshot,set:value=>{groundSnapshot=value}},
    {id:'cameras',file:'cameras.json',key:'byVenue',get:()=>cameraSnapshot,set:value=>{cameraSnapshot=value}},
    {id:'roads',file:'roads.json',key:'byVenue',get:()=>roadSnapshot,set:value=>{roadSnapshot=value}},
    {id:'spc',file:'spc_outlooks.json',key:'byVenue',get:()=>spcSnapshot,set:value=>{spcSnapshot=value}},
    {id:'eonet',file:'eonet.json',key:'byVenue',get:()=>eonetSnapshot,set:value=>{eonetSnapshot=value}},
    {id:'nifc',file:'nifc_wildfire.json',key:'byVenue',get:()=>nifcSnapshot,set:value=>{nifcSnapshot=value}},
    {id:'airnow',file:'airnow_pm25.json',key:'byVenue',get:()=>airnowSnapshot,set:value=>{airnowSnapshot=value}},
    {id:'hms-smoke',file:'hms_smoke.json',key:'byVenue',get:()=>hmsSmokeSnapshot,set:value=>{hmsSmokeSnapshot=value}},
    {id:'green-bay-alerts',file:'green_bay_alerts.json',key:'sources',get:()=>greenBayAlertsSnapshot,set:value=>{greenBayAlertsSnapshot=value}},
    {id:'lambeau-plan',file:'lambeau_gameday.json',key:'claims',clock:'checkedAt',get:()=>lambeauPlanSnapshot,set:value=>{lambeauPlanSnapshot=value}},
    {id:'packers-release',file:'packers_game_release.json',key:'claims',clock:'checkedAt',get:()=>packersGameReleaseSnapshot,set:value=>{packersGameReleaseSnapshot=value}},
    {id:'patriots-preview',file:'patriots_game_preview.json',key:'claims',clock:'checkedAt',get:()=>patriotsGamePreviewSnapshot,set:value=>{patriotsGamePreviewSnapshot=value}},
    {id:'jets-guide',file:'jets_gameday_guide.json',key:'claims',clock:'checkedAt',get:()=>jetsGamedayGuideSnapshot,set:value=>{jetsGamedayGuideSnapshot=value}},
    {id:'seahawks-guide',file:'seahawks_gameday.json',key:'claims',clock:'checkedAt',get:()=>seahawksGamedaySnapshot,set:value=>{seahawksGamedaySnapshot=value}},
    {id:'titans-guide',file:'titans_gameday.json',key:'claims',clock:'checkedAt',get:()=>titansGamedaySnapshot,set:value=>{titansGamedaySnapshot=value}},
    {id:'chiefs-game-center',file:'chiefs_game_center.json',key:'claims',clock:'checkedAt',get:()=>chiefsGameCenterSnapshot,set:value=>{chiefsGameCenterSnapshot=value}},
    {id:'ridekc-arrowhead',file:'ridekc_arrowhead.json',key:'nearbyRoutes',clock:'checkedAt',get:()=>ridekcArrowheadSnapshot,set:value=>{ridekcArrowheadSnapshot=value}},
    {id:'cardinals-lions',file:'cardinals_lions_broadcast.json',key:'claims',clock:'checkedAt',get:()=>cardinalsLionsSnapshot,set:value=>{cardinalsLionsSnapshot=value}},
    {id:'steelers-colts',file:'steelers_colts_broadcast.json',key:'claims',clock:'checkedAt',get:()=>steelersColtsSnapshot,set:value=>{steelersColtsSnapshot=value}},
    {id:'az511-alerts',file:'az511_public_alerts.json',key:'entries',clock:'checkedAt',get:()=>az511AlertsSnapshot,set:value=>{az511AlertsSnapshot=value}},
    {id:'houston-transtar',file:'houston_transtar_rss.json',key:'feeds',clock:'checkedAt',get:()=>houstonTranstarSnapshot,set:value=>{houstonTranstarSnapshot=value}},
    {id:'falcons-guide',file:'falcons_gameday.json',key:'claims',clock:'checkedAt',get:()=>falconsGamedaySnapshot,set:value=>{falconsGamedaySnapshot=value}},
    {id:'commanders-guide',file:'commanders_gameday.json',key:'claims',clock:'checkedAt',get:()=>commandersGamedaySnapshot,set:value=>{commandersGamedaySnapshot=value}},
    {id:'rams-bills-guide',file:'rams_bills_gameday.json',key:'claims',clock:'checkedAt',get:()=>ramsBillsGamedaySnapshot,set:value=>{ramsBillsGamedaySnapshot=value}},
    {id:'dolphins-crucial-catch',file:'dolphins_crucial_catch.json',key:'claims',clock:'checkedAt',get:()=>dolphinsCrucialCatchSnapshot,set:value=>{dolphinsCrucialCatchSnapshot=value}},
    {id:'saints-guide',file:'saints_gameday.json',key:'claims',clock:'checkedAt',get:()=>saintsGamedaySnapshot,set:value=>{saintsGamedaySnapshot=value}},
    {id:'nola-ready-event',file:'nola_ready_event.json',key:'claims',clock:'checkedAt',get:()=>nolaReadyEventSnapshot,set:value=>{nolaReadyEventSnapshot=value}},
    {id:'nola-ready-active',file:'nola_ready_active.json',key:'entries',clock:'checkedAt',get:()=>nolaReadyActiveSnapshot,set:value=>{nolaReadyActiveSnapshot=value}},
    {id:'nola-ready-updates',file:'nola_ready_updates.json',key:'entries',clock:'checkedAt',get:()=>nolaReadyUpdatesSnapshot,set:value=>{nolaReadyUpdatesSnapshot=value}},
    {id:'nashville-oem-news',file:'nashville_oem_news.json',key:'recent',clock:'checkedAt',get:()=>nashvilleOemNewsSnapshot,set:value=>{nashvilleOemNewsSnapshot=value}},
    {id:'nashville-titans-closures',file:'nashville_titans_closures.json',key:'entries',clock:'checkedAt',get:()=>nashvilleTitansClosuresSnapshot,set:value=>{nashvilleTitansClosuresSnapshot=value}},
    {id:'wego-titans-alert',file:'wego_titans_alert.json',key:'routeNumbers',clock:'checkedAt',get:()=>wegoTitansAlertSnapshot,set:value=>{wegoTitansAlertSnapshot=value}},
    {id:'nola-ready-regional',file:'nola_ready_regional.json',key:'claims',clock:'checkedAt',get:()=>nolaReadyRegionalSnapshot,set:value=>{nolaReadyRegionalSnapshot=value}},
    {id:'norta-alerts',file:'norta_alerts.json',key:'recent',clock:'retrievedAt',get:()=>nortaAlertsSnapshot,set:value=>{nortaAlertsSnapshot=value}},
    {id:'nola-calls',file:'nola_public_calls.json',key:'context',clock:'builtAt',get:()=>nolaPublicCallsSnapshot,set:value=>{nolaPublicCallsSnapshot=value}},
    {id:'marta-rail',file:'marta_rail.json',key:'claims',clock:'checkedAt',get:()=>martaRailSnapshot,set:value=>{martaRailSnapshot=value}},
    {id:'marta-alert-preview',file:'marta_alert_preview.json',key:'alerts',clock:'retrievedAt',get:()=>martaAlertPreviewSnapshot,set:value=>{martaAlertPreviewSnapshot=value}},
    {id:'georgia-traffic',file:'georgia_traffic.json',key:'records',clock:'retrievedAt',get:()=>georgiaTrafficSnapshot,set:value=>{georgiaTrafficSnapshot=value}},
    {id:'sound-transit-seahawks',file:'sound_transit_seahawks.json',key:'arrivals',clock:'checkedAt',get:()=>soundTransitSeahawksSnapshot,set:value=>{soundTransitSeahawksSnapshot=value}},
    {id:'sound-transit-alerts',file:'sound_transit_alerts.json',key:'alerts',clock:'retrievedAt',get:()=>soundTransitAlertsSnapshot,set:value=>{soundTransitAlertsSnapshot=value}},
    {id:'glendale-police',file:'glendale_public_calls.json',key:'byVenue',get:()=>glendalePoliceSnapshot,set:value=>{glendalePoliceSnapshot=value}},
    {id:'seattle-fire',file:'seattle_fire_aggregate.json',key:'nearbyCount',kind:'nonnegative_integer',clock:'checkedAt',get:()=>seattleFireAggregateSnapshot,set:value=>{seattleFireAggregateSnapshot=value}},
    {id:'seattle-spd-blotter',file:'seattle_spd_blotter.json',key:'recent',clock:'checkedAt',get:()=>seattleSpdBlotterSnapshot,set:value=>{seattleSpdBlotterSnapshot=value}},
    {id:'houston-active',file:'houston_active_incidents.json',key:'totalCount',kind:'nonnegative_integer',clock:'checkedAt',get:()=>houstonActiveIncidentsSnapshot,set:value=>{houstonActiveIncidentsSnapshot=value}},
    {id:'nashville-police',file:'nashville_police_count.json',key:'activeCount',kind:'nonnegative_integer',clock:'checkedAt',get:()=>nashvillePoliceCountSnapshot,set:value=>{nashvillePoliceCountSnapshot=value}},
    {id:'reports',file:'reports/index.json',key:'reports',get:()=>publishedReports,set:value=>{publishedReports=value}},
    {id:'wpcRain',file:'wpc_rain_outlooks.json',key:'byVenue',get:()=>wpcRainSnapshot,set:value=>{wpcRainSnapshot=value}},
    {id:'airspace',file:'seams.json',key:'byGame',get:()=>seamsSnapshot,set:value=>{seamsSnapshot=value}},
    {id:'tfr',file:'tfr.json',key:'byVenue',get:()=>tfrSnapshot,set:value=>{tfrSnapshot=value}},
    {id:'septa',file:'septa_b_alerts.json',key:'alerts',clock:'retrievedAt',get:()=>septaSnapshot,set:value=>{septaSnapshot=value}},
    {id:'njTransitRail',file:'njtransit_event_rail.json',key:'byGame',get:()=>njTransitRailSnapshot,set:value=>{njTransitRailSnapshot=value}},
    {id:'nj511',file:'nj511_events.json',key:'byGame',get:()=>nj511Snapshot,set:value=>{nj511Snapshot=value}},
    {id:'phillyAlerts',file:'philly_city_alerts.json',key:'context',get:()=>phillyAlertsSnapshot,set:value=>{phillyAlertsSnapshot=value}},
    {id:'phillyPermits',file:'philly_lane_permits.json',key:'byGame',get:()=>phillyPermitsSnapshot,set:value=>{phillyPermitsSnapshot=value}}
  ];
  try{
    const results=await Promise.allSettled(feeds.map(feed=>json(feed.file,15000)));
    const changed=new Set(),unavailable=[];
    for(let i=0;i<feeds.length;i++){
      const feed=feeds[i],result=results[i];
      if(feed.id==='houston-active'&&result.status==='fulfilled'&&result.value?.schema==='event-atlas.houston-active-incidents-count.v1'&&result.value.status==='failed'&&Date.parse(result.value.checkedAt)>Date.parse(feed.get()?.checkedAt||0)){
        feed.set(result.value);changed.add(feed.id);continue;
      }
      if(result.status==='rejected'||!validPublishedSnapshotValue(result.value,feed.key,feed.kind||'object')){
        unavailable.push(feed.id);continue;
      }
      if(feed.id==='schedule'&&!result.value.source?.status){unavailable.push(feed.id);continue}
      if(shouldAdoptPublishedSnapshot(feed.get(),result.value,feed.key,feed.clock||'builtAt',feed.kind||'object')){
        feed.set(result.value);changed.add(feed.id);
      }
    }
    $('freshness').textContent=`Built ${fmt(snapshot.builtAt)} · published sources checked ${fmt(Date.now())}${unavailable.length?' · refresh unavailable: '+unavailable.join(', '):''}`;
    if(changed.has('schedule')){
      const games=snapshot.games,next=sorted(games.slice()).find(game=>Date.parse(game.kickoff)>=Date.now());
      $('game-count').textContent=games.length.toLocaleString();
      $('venue-count').textContent=new Set(games.map(game=>game.venue.id)).size;
      $('next-kickoff').textContent=next?fmt(next.kickoff):'Season complete';
      $('source-state').textContent=humanLabel(snapshot.source.status);
      renderList();
      if(!games.some(game=>game.id===selected))selected=next?.id||games[0]?.id||null;
      if(selected)selectGame(selected);
      else $('detail').innerHTML='<p class="empty">No game in the current published schedule.</p>';
    }
    if(changed.has('schedule')||changed.has('ground')||changed.has('cameras')||changed.has('roads'))renderCoverage();
    const game=snapshot.games.find(item=>item.id===selected);
    if(game&&!changed.has('schedule')){
      if(changed.has('ground'))renderGround(game);
      if(changed.has('cameras'))renderCameras(game);
      if(changed.has('roads'))renderRoads(game);
      if(changed.has('nj511'))renderNj511(game);
      if(changed.has('spc'))renderSpc(game);
      if(changed.has('wpcRain'))renderWpcRain(game);
      if(changed.has('airspace'))renderAirspace(game);
      if(changed.has('tfr'))renderTfr(game);
      if(changed.has('septa')||changed.has('njTransitRail'))renderTransit(game);
      if(changed.has('phillyAlerts')&&game.venue.id==='3806')renderPublicSafety(game);
      if(changed.has('glendale-police')&&game.venue.id==='3970')renderPublicSafety(game);
      if(changed.has('phillyPermits')&&game.venue.id==='3806')renderRoads(game);
      if(changed.size)renderBrief(game);
    }
  }finally{publicationRefreshPending=false}
}
async function init(){loadSofiSources();loadNtas();loadSpaceWeather();loadNews();loadGameArticles();loadPublishedChanges();try{snapshot=await json('nfl.json');try{eventExamples=(await json('event_examples.json')).events;}catch{eventExamples=[];}snapshot.games.push(...eventExamples);const games=snapshot.games,venues=new Set(games.map(game=>game.venue.id)),next=sorted(games.slice()).find(game=>Date.parse(game.kickoff)>=Date.now());$('game-count').textContent=games.length.toLocaleString();$('venue-count').textContent=venues.size;$('next-kickoff').textContent=next?fmt(next.kickoff):'Season complete';$('source-state').textContent=humanLabel(snapshot.source.status);$('freshness').textContent='Built '+fmt(snapshot.builtAt);$('week').innerHTML+=Array.from({length:18},(_,index)=>`<option value="${index+1}">Week ${index+1}</option>`).join('');$('search').oninput=renderList;$('week').onchange=renderList;$('time').onchange=renderList;renderList();renderCoverage();const live=games.find(game=>game.status==='in progress in source');if(live||next)selectGame((live||next).id);try{indyPoliceSnapshot=await json('indianapolis_public_safety.json')}catch{indyPoliceSnapshot={status:'error'}}if(selected)renderPublicSafety(games.find(game=>game.id===selected));try{glendalePoliceSnapshot=await json('glendale_public_calls.json')}catch{glendalePoliceSnapshot={status:'error'}}if(selected)renderPublicSafety(games.find(game=>game.id===selected));try{charlottePoliceSnapshot=await json('charlotte_public_safety.json')}catch{charlottePoliceSnapshot={status:'error'}}if(selected)renderPublicSafety(games.find(game=>game.id===selected));try{denverPoliceSnapshot=await json('denver_public_safety.json')}catch{denverPoliceSnapshot={status:'error'}}if(selected)renderPublicSafety(games.find(game=>game.id===selected));try{phillyAlertsSnapshot=await json('philly_city_alerts.json')}catch{phillyAlertsSnapshot={status:'error'}}if(selected)renderPublicSafety(games.find(game=>game.id===selected));try{phillyPermitsSnapshot=await json('philly_lane_permits.json')}catch{phillyPermitsSnapshot={status:'error'}}if(selected)renderRoads(games.find(game=>game.id===selected));try{groundSnapshot=await json('ground_footprints.json')}catch{groundSnapshot=null}renderCoverage();if(selected)renderGround(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{cameraSnapshot=await json('cameras.json')}catch{cameraSnapshot=null}renderCoverage();if(selected)renderCameras(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{roadSnapshot=await json('roads.json')}catch{roadSnapshot=null}renderCoverage();if(selected)renderRoads(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{seamsSnapshot=await json('seams.json')}catch{seamsSnapshot=null}if(selected)renderAirspace(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{tfrSnapshot=await json('tfr.json')}catch{tfrSnapshot=null}if(selected)renderTfr(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{spcSnapshot=await json('spc_outlooks.json')}catch{spcSnapshot={status:'error'}}if(selected){const game=games.find(game=>game.id===selected);renderSpc(game);renderBrief(game)}try{wpcRainSnapshot=await json('wpc_rain_outlooks.json')}catch{wpcRainSnapshot={status:'error'}}if(selected){const game=games.find(game=>game.id===selected);renderWpcRain(game);renderBrief(game)}try{septaSnapshot=await json('septa_b_alerts.json')}catch{septaSnapshot={status:'error',alerts:[]}}if(selected){const game=games.find(game=>game.id===selected);renderTransit(game);renderBrief(game)}try{njTransitRailSnapshot=await json('njtransit_event_rail.json')}catch{njTransitRailSnapshot={status:'error',byGame:{}}}if(selected){const game=games.find(game=>game.id===selected);renderTransit(game);renderBrief(game)}try{nj511Snapshot=await json('nj511_events.json')}catch{nj511Snapshot={status:'error',byGame:{}}}if(selected){const game=games.find(game=>game.id===selected);renderNj511(game);renderBrief(game)}try{eonetSnapshot=await json('eonet.json')}catch{eonetSnapshot={status:'failed',byVenue:{}}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nifcSnapshot=await json('nifc_wildfire.json')}catch{nifcSnapshot={status:'failed',byVenue:{}}}if(selected)renderBrief(games.find(game=>game.id===selected));try{airnowSnapshot=await json('airnow_pm25.json')}catch{airnowSnapshot={status:'failed',byVenue:{}}}if(selected)renderBrief(games.find(game=>game.id===selected));try{hmsSmokeSnapshot=await json('hms_smoke.json')}catch{hmsSmokeSnapshot={status:'failed',byVenue:{}}}if(selected)renderBrief(games.find(game=>game.id===selected));try{greenBayAlertsSnapshot=await json('green_bay_alerts.json')}catch{greenBayAlertsSnapshot={status:'failed',sources:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{lambeauPlanSnapshot=await json('lambeau_gameday.json')}catch{lambeauPlanSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{packersGameReleaseSnapshot=await json('packers_game_release.json')}catch{packersGameReleaseSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{patriotsGamePreviewSnapshot=await json('patriots_game_preview.json')}catch{patriotsGamePreviewSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{jetsGamedayGuideSnapshot=await json('jets_gameday_guide.json')}catch{jetsGamedayGuideSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{seahawksGamedaySnapshot=await json('seahawks_gameday.json')}catch{seahawksGamedaySnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{titansGamedaySnapshot=await json('titans_gameday.json')}catch{titansGamedaySnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{chiefsGameCenterSnapshot=await json('chiefs_game_center.json')}catch{chiefsGameCenterSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{ridekcArrowheadSnapshot=await json('ridekc_arrowhead.json')}catch{ridekcArrowheadSnapshot={status:'failed',nearbyRoutes:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{cardinalsLionsSnapshot=await json('cardinals_lions_broadcast.json')}catch{cardinalsLionsSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{steelersColtsSnapshot=await json('steelers_colts_broadcast.json')}catch{steelersColtsSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{az511AlertsSnapshot=await json('az511_public_alerts.json')}catch{az511AlertsSnapshot={status:'failed',entries:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{houstonTranstarSnapshot=await json('houston_transtar_rss.json')}catch{houstonTranstarSnapshot={status:'failed',feeds:{}}}if(selected)renderBrief(games.find(game=>game.id===selected));try{houstonActiveIncidentsSnapshot=await json('houston_active_incidents.json')}catch{houstonActiveIncidentsSnapshot={status:'failed',totalCount:null}}if(selected)renderBrief(games.find(game=>game.id===selected));try{falconsGamedaySnapshot=await json('falcons_gameday.json')}catch{falconsGamedaySnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{commandersGamedaySnapshot=await json('commanders_gameday.json')}catch{commandersGamedaySnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{ramsBillsGamedaySnapshot=await json('rams_bills_gameday.json')}catch{ramsBillsGamedaySnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{dolphinsCrucialCatchSnapshot=await json('dolphins_crucial_catch.json')}catch{dolphinsCrucialCatchSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{saintsGamedaySnapshot=await json('saints_gameday.json')}catch{saintsGamedaySnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nolaReadyEventSnapshot=await json('nola_ready_event.json')}catch{nolaReadyEventSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nolaReadyActiveSnapshot=await json('nola_ready_active.json')}catch{nolaReadyActiveSnapshot={status:'failed',entries:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nolaReadyUpdatesSnapshot=await json('nola_ready_updates.json')}catch{nolaReadyUpdatesSnapshot={status:'failed',entries:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nashvilleOemNewsSnapshot=await json('nashville_oem_news.json')}catch{nashvilleOemNewsSnapshot={status:'failed',recent:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nashvilleTitansClosuresSnapshot=await json('nashville_titans_closures.json')}catch{nashvilleTitansClosuresSnapshot={status:'failed',entries:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{wegoTitansAlertSnapshot=await json('wego_titans_alert.json')}catch{wegoTitansAlertSnapshot={status:'failed',routeNumbers:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nolaReadyRegionalSnapshot=await json('nola_ready_regional.json')}catch{nolaReadyRegionalSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nortaAlertsSnapshot=await json('norta_alerts.json')}catch{nortaAlertsSnapshot={status:'failed',recent:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{nolaPublicCallsSnapshot=await json('nola_public_calls.json')}catch{nolaPublicCallsSnapshot={status:'failed',context:null}}if(selected)renderBrief(games.find(game=>game.id===selected));try{martaRailSnapshot=await json('marta_rail.json')}catch{martaRailSnapshot={status:'failed',claims:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{martaAlertPreviewSnapshot=await json('marta_alert_preview.json')}catch{martaAlertPreviewSnapshot={status:'failed',alerts:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{georgiaTrafficSnapshot=await json('georgia_traffic.json')}catch{georgiaTrafficSnapshot={status:'failed',records:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{soundTransitSeahawksSnapshot=await json('sound_transit_seahawks.json')}catch{soundTransitSeahawksSnapshot={status:'failed',arrivals:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{soundTransitAlertsSnapshot=await json('sound_transit_alerts.json')}catch{soundTransitAlertsSnapshot={status:'error',alerts:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{const published=await json('seattle_fire_aggregate.json');if(shouldAdoptPublishedSnapshot(seattleFireAggregateSnapshot,published,'nearbyCount','checkedAt','nonnegative_integer'))seattleFireAggregateSnapshot=published}catch{if(!seattleFireAggregateSnapshot)seattleFireAggregateSnapshot={status:'error'}}if(selected)renderBrief(games.find(game=>game.id===selected));try{seattleSpdBlotterSnapshot=await json('seattle_spd_blotter.json')}catch{seattleSpdBlotterSnapshot={status:'failed',recent:[]}}if(selected)renderBrief(games.find(game=>game.id===selected));try{const published=await json('nashville_police_count.json');if(shouldAdoptPublishedSnapshot(nashvillePoliceCountSnapshot,published,'activeCount','checkedAt','nonnegative_integer'))nashvillePoliceCountSnapshot=published}catch{if(!nashvillePoliceCountSnapshot)nashvillePoliceCountSnapshot={status:'failed',activeCount:null}}if(selected)renderBrief(games.find(game=>game.id===selected));try{publishedReports=await json('reports/index.json')}catch{publishedReports=null}if(selected)renderBrief(games.find(game=>game.id===selected))}catch(error){$('games').innerHTML=`<p class="empty" style="padding:20px">Schedule unavailable: ${esc(error.message)}</p>`;$('freshness').textContent='Source unavailable';$('result-count').textContent='Unavailable';$('source-state').textContent='UNAVAILABLE';$('detail').innerHTML='<p class="empty">The schedule could not be loaded. Reload the workspace to retry; unavailable data does not establish an absence of hazards.</p><button type="button" id="retry-schedule">Reload workspace</button>';$('retry-schedule').onclick=()=>location.reload()}}
initializeWorkspaceViews({onRestoreEvent:id=>{if(snapshot?.games?.some(game=>game.id===id))selectGame(id);}});
installBriefingGuide();
init();
setInterval(()=>{if(document.visibilityState==='visible'){refreshPublishedSnapshots();loadSofiSources();loadNews();loadGameArticles();loadNtas();loadSpaceWeather();loadPublishedChanges()}},300000);

document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||!snapshot||!selected)return;refreshPublishedSnapshots();loadSofiSources();loadNews();loadGameArticles();loadNtas();loadSpaceWeather();loadPublishedChanges();const game=snapshot.games.find(item=>item.id===selected);if(game&&(!directGame||Date.now()-Date.parse(directGame.checkedAt)>=300000))loadDirectGame(game);if(game?.venue.id==='3673'&&Date.now()-lastSeattleFireDirectCheckAt>=300000)refreshSeattleFireAggregate(game);if(game?.venue.id==='3810'&&Date.now()-lastNashvillePoliceDirectCheckAt>=300000)refreshNashvillePoliceCount(game);if(game&&Number.isFinite(game.venue.lat)&&Number.isFinite(game.venue.lon)&&(!briefConditions||Date.now()-briefConditions.at>=300000))loadConditions(game)});
