import {selectRoadContext} from './road_relevance.js?v=20261009-5';
import {selectWeatherContext} from './weather_relevance.js';
import {summarizeCoverage} from './coverage_summary.js?v=20261009-8';
import {venueMarkers} from './venue_map.js?v=20261009-1';
import {summarizeArlingtonCalls,seattleCallQueries,summarizeSeattleCalls,seattleCallsLayer,seattleCallsViewer} from './public_safety_relevance.js?v=20261009-2';
import {pointInsideRing} from './ground_relevance.js?v=20261009-1';
import {buildNflEventPicture} from './nfl_event_picture.js?v=20261009-22';
import {buildNflEvidenceBundle} from './nfl_evidence_bundle.js?v=20261009-15';
import {tfrAtKickoff} from './tfr_notam.js?v=20261009-1';
import {chicagoCrimeQuery,chicagoCrimeDataset,summarizeChicagoCrimes} from './chicago_public_safety.js?v=20261009-1';
import {indianapolisCfsLayer} from './indianapolis_public_safety.js';
import {charlotteIncidentsLayer} from './charlotte_public_safety.js';
import {cmpdOpenTrafficFeed,parseCmpdOpenTrafficXml,summarizeCmpdOpenTraffic} from './cmpd_open_traffic.js';
import {mbtaFoxboroAlertsUrl,summarizeMbtaFoxboroAlerts} from './mbta_foxboro_alerts.js';
import {mbtaFoxboroSchedulesUrl,summarizeMbtaFoxboroSchedules} from './mbta_foxboro_schedules.js';
import {mbtaFoxboroPredictionsUrl,summarizeMbtaFoxboroPredictions} from './mbta_foxboro_predictions.js';
import {buildExerciseBrief,exerciseStages} from './demo_exercise.js';
import {selectNflNews} from './nfl_news_context.js';
import {shouldAdoptPublishedSnapshot} from './published_snapshot_refresh.js';
import {diffEventPicture} from './event_picture_changes.js';
import {parseTennesseeRoadEvents,tennesseeRoadLayer,tennesseeRoadQuery} from './tennessee_road_events.js?v=20261009-1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const gameTime=game=>game.timeTbd?new Date(game.kickoff).toLocaleDateString(undefined,{dateStyle:'medium',timeZone:'America/New_York'})+' · kickoff TBD':fmt(game.kickoff);
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};
const cache=new Map(),changeHistory=new Map();let snapshot,cameraSnapshot,roadSnapshot,seamsSnapshot,tfrSnapshot,groundSnapshot,newsSnapshot,ntasSnapshot,indyPoliceSnapshot,charlottePoliceSnapshot,selected,cameraRefreshTimer,cameraPlayer,cameraFrame,hlsLoader,publicSafetyRefreshTimer,briefRefreshTimer,conditionsRefreshTimer,conditionsRequestSerial=0,conditionsPendingFor=null,briefConditions,briefPolice,cmpdTraffic,mbtaTransit,mbtaSchedule,mbtaPredictions,transitRefreshTimer,liveTennesseeRoad,tennesseeRoadRefreshTimer,exerciseEnabled=false,exerciseStage=0,exercisePlaybackTimer,publicationRefreshPending=false,lastPublicationCheckAt=0;
const arlingtonSource='https://gis2.arlingtontx.gov/agsext2/rest/services/Police/ActiveIncident/MapServer/0';
const arlingtonQuery=arlingtonSource+'/query?'+new URLSearchParams({where:'1=1',outFields:'OBJECTID,CallDate,UpdatedDate',returnGeometry:'true',outSR:'4326',f:'geojson'});
async function json(url,timeoutMs=0){const local=new URL(url,location.href).origin===location.origin;const result=await fetch(url,{headers:{Accept:'application/geo+json, application/json'},cache:local?'no-store':'default',signal:timeoutMs?AbortSignal.timeout(timeoutMs):undefined});if(!result.ok)throw Error('HTTP '+result.status);return result.json()}
function sorted(games){const now=Date.now(),upcoming=$('time').value==='upcoming';return games.sort((a,b)=>{const at=Date.parse(a.kickoff),bt=Date.parse(b.kickoff);if(!upcoming)return at-bt;const af=at>=now,bf=bt>=now;return af!==bf?af?-1:1:af?at-bt:bt-at})}
function renderList(){const q=$('search').value.trim().toLowerCase(),week=$('week').value;const items=sorted(snapshot.games.filter(game=>(!week||String(game.week)===week)&&(!q||[game.title,game.venue.name,game.venue.address].some(value=>value.toLowerCase().includes(q)))));$('result-count').textContent=items.length+' games';$('games').innerHTML=items.length?items.map(game=>`<button class="game ${game.id===selected?'selected':''}" data-id="${esc(game.id)}"><span class="game-top"><span>WEEK ${game.week}</span><span class="date">${esc(gameTime(game))}</span></span><strong>${esc(game.title)}</strong><small>${esc(game.venue.name)} · ${esc(game.venue.address)}</small></button>`).join(''):'<p class="empty" style="padding:20px">No games match these filters.</p>';for(const button of $('games').querySelectorAll('.game'))button.onclick=()=>selectGame(button.dataset.id)}
function fact(label,value){return `<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`}
function link(url,label){try{const parsed=new URL(url);if(parsed.protocol!=='https:')return '';return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`}catch{return ''}}
const selectedRoadSnapshot=game=>game?.venue.id==='3810'&&liveTennesseeRoad?.state==='ok'&&Date.now()-liveTennesseeRoad.checkedAt<=15*60000?liveTennesseeRoad.snapshot:roadSnapshot;
const briefInputs=()=>({schedule:snapshot,ground:groundSnapshot,airspace:seamsSnapshot,tfr:tfrSnapshot,cameras:cameraSnapshot,roads:selectedRoadSnapshot(snapshot?.games.find(game=>game.id===selected)),news:newsSnapshot,roadDirect:liveTennesseeRoad,conditions:briefConditions,police:briefPolice,cmpdTraffic,transit:mbtaTransit,transitSchedule:mbtaSchedule,transitPredictions:mbtaPredictions,ntas:ntasSnapshot});
function downloadEvidenceBundle(game){
  if(selected!==game.id)return;
  const bundle=buildNflEvidenceBundle(game,briefInputs());
  bundle.clientObservedChanges={state:'in_memory_since_page_open',items:changeHistory.get(game.id)?.items||[],interpretation:'These are changes observed by this browser session in bounded source samples. They are not a complete publisher history, a threat finding, or evidence that a missing item resolved.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)+'\n'],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`event-atlas-${game.id.replace(/[^A-Za-z0-9_-]/g,'-')}-public-evidence.json`;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function downloadExerciseBundle(game){
  if(selected!==game.id||!exerciseEnabled)return;
  const bundle={kind:'simulated_training_exercise',venue:{id:game.venue.id,name:game.venue.name},event:{id:game.id,title:game.title},exercise:buildExerciseBrief(exerciseStage),notice:'Every observation and correlation is fictional. No live source or AI model produced this exercise brief.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)+'\n'],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`event-atlas-${game.id.replace(/[^A-Za-z0-9_-]/g,'-')}-simulated-exercise.json`;
  document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function renderBrief(game){
  const target=$('event-picture');
  if(!target||!game)return;
  const picture=buildNflEventPicture(game,briefInputs());
  const news=selectNflNews(game,newsSnapshot);
  const prior=changeHistory.get(game.id);
  const currentGame={kickoff:game.kickoff,status:game.status,timeTbd:game.timeTbd,sourceUrl:game.sourceUrl};
  const observed=prior?diffEventPicture(prior.picture,picture,prior.news,news,prior.game,currentGame):[];
  const updates=[...observed.reverse(),...(prior?.items||[])].slice(0,24);
  changeHistory.set(game.id,{picture,news,game:currentGame,items:updates});
  const total=picture.cueCounts.weather+picture.cueCounts.road+picture.cueCounts.transit;
  target.innerHTML=`<p class="feed-state">PUBLIC-SOURCE EVENT PICTURE · GENERATED ${esc(fmt(picture.generatedAt))}</p><p><strong>Assessment: severity and confidence not assessed.</strong> ${picture.cueCounts.weather} NWS alert review candidate${picture.cueCounts.weather===1?'':'s'}; ${picture.cueCounts.road} published roadway time overlap${picture.cueCounts.road===1?'':'s'}; ${picture.cueCounts.transit} station alert time overlap${picture.cueCounts.transit===1?'':'s'}. ${esc(picture.interpretation)}</p>`+
    `<details class="brief-details"><summary>Changes observed since this page opened · ${updates.length}</summary>${updates.length?updates.map(item=>`<div class="brief-cue"><strong>${esc(item.title)}</strong><span>${esc(item.kind.replaceAll('_',' '))} · noticed ${esc(fmt(item.observedAt))} · ${esc(item.detail)}</span>${link(item.sourceUrl,'Publisher source')}</div>`).join(''):'<p>No source-status transition or newly displayed cue has been observed in this browser session. This does not establish that conditions are unchanged or safe.</p>'}<p>This is an in-memory comparison of bounded displayed samples, not a complete change history. A disappearing item is not treated as resolved.</p></details>`+
    (picture.cues.length?`<div class="brief-cues">${picture.cues.map(cue=>`<div class="brief-cue"><strong>${esc(cue.type.toUpperCase())} · ${esc(cue.title)}</strong><span>${esc(cue.basis)}${cue.sourceAt?' · source time '+esc(fmt(cue.sourceAt)):''}</span>${link(cue.sourceUrl,cue.type==='road condition'?'Agency data layer':cue.type==='transit alert'?'MBTA alert':'NWS alert')}</div>`).join('')}${total>picture.cues.length?`<p>These panels show bounded samples. Consult the agency feeds for the complete set of source records.</p>`:''}</div>`:'')+
    `<details class="brief-details"><summary>NFL publisher headlines · ${news.state==='current_snapshot'?news.articles.length+' team mention'+(news.articles.length===1?'':'s'):esc(news.state)}</summary>${news.state==='current_snapshot'?news.articles.length?news.articles.map(item=>`<div class="brief-cue"><strong>${esc(item.title)}</strong><span>${esc(item.description)} · ${esc(item.publisher)} RSS · ${esc(fmt(item.publishedAt))} · ${item.matchBasis==='both_teams_mentioned'?'Both teams named':'One team named'}</span>${link(item.url,'Full publisher article')}</div>`).join(''):`<p>No team-name match in the current ${esc(news.publisher)} NFL RSS snapshot. This does not establish an absence of relevant news.</p>`:'<p>NFL publisher RSS snapshot is unavailable or stale.</p>'}<p>Headlines and any shown descriptions are supplied by ${esc(news.publisher||'the publisher')}. Team-name matching is discovery context; it does not confirm relevance to this game, a person’s attendance, venue impact, or a threat. ${link(news.sourceUrl,'Publisher NFL RSS')}</p></details>`+
    `<details class="brief-details"><summary>Zone and sensor status</summary><div class="brief-grid">${picture.zoneReview.map(zone=>`<div><strong>${esc(zone.name)}</strong><span>${esc(zone.state)} · ${esc(zone.owner)}</span><small>${esc(zone.purpose)} ${link(zone.sourceUrl,'Source')}</small></div>`).join('')}</div></details><details class="brief-details"><summary>Source status and gaps</summary><div class="brief-grid">${picture.sources.map(source=>`<div><strong>${esc(source.name)}</strong><span>${esc(source.state)}${source.asOf?' · '+esc(fmt(source.asOf)):''}</span><small>${esc(source.detail)} ${link(source.sourceUrl,'Source')}</small></div>`).join('')}</div><p><strong>Unresolved for this brief</strong></p><ul>${picture.gaps.map(gap=>`<li>${esc(gap)}</li>`).join('')}</ul></details><button type="button" class="evidence-download">Download public evidence bundle (JSON)</button><p class="bundle-note">Includes source status, candidate geography, bounded public observations, and gaps at download time. Unreviewed; no threat assessment or named-person records.</p>`;
  target.querySelector('.evidence-download').onclick=()=>downloadEvidenceBundle(game);
}
function renderExercise(game){
  const target=$('exercise');if(!target||!game)return;
  const heading=`<div class="exercise-head"><span class="exercise-label">SIMULATED EXERCISE · FICTIONAL DATA</span><button type="button" class="exercise-toggle" aria-pressed="${exerciseEnabled}">${exerciseEnabled?'Close exercise':'Open exercise mode'}</button></div>`;
  if(!exerciseEnabled){target.innerHTML=heading+'<p>Replay an evidence-linked threat briefing across every source domain in the design brief. Exercise records are separate from the public-source event picture and its downloadable evidence bundle.</p>';target.querySelector('.exercise-toggle').onclick=()=>{exerciseEnabled=true;renderExercise(game)};return}
  const brief=buildExerciseBrief(exerciseStage);
  target.innerHTML=heading+`<p><strong>Exercise venue:</strong> ${esc(game.venue.name)}. The venue and schedule are real source records; every observation below is fictional. ${esc(brief.assessment.model)}. Severity and confidence are not assessed.</p><div class="exercise-steps">${exerciseStages.map((stage,index)=>`<button type="button" data-stage="${index}" aria-pressed="${index===exerciseStage}">${esc(stage.label)}</button>`).join('')}<button type="button" class="exercise-play">${exercisePlaybackTimer?'Pause replay':exerciseStage===exerciseStages.length-1?'Replay from start':'Play scenario'}</button></div><p class="feed-state" aria-live="polite">PLAYBACK CLOCK ${esc(brief.clock)} · ${brief.observations.length} FICTIONAL SIGNALS · ${brief.correlations.length} REVIEW CANDIDATES</p><h5>Cross-source review candidates</h5>`+
    (brief.correlations.length?`<div class="exercise-correlations">${brief.correlations.map(item=>`<div class="exercise-correlation"><strong>${esc(item.title)}</strong><span>${esc(item.state)} · evidence ${esc(item.evidence.join(', '))}</span><p>${esc(item.basis)}</p><small>Analyst action: ${esc(item.next)}</small></div>`).join('')}</div>`:'<p>Signals are visible; no cross-source candidate meets the exercise rule yet.</p>')+
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
async function loadNtas(){
  const target=$('ntas');
  try{
    const feed=await json('ntas.json'),age=Date.now()-Date.parse(feed.retrievedAt);
    ntasSnapshot=feed;
    if(selected&&snapshot)renderBrief(snapshot.games.find(game=>game.id===selected));
    if(feed.status!=='ok'||!Number.isFinite(age)||age>12*3600000||age<0){
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
async function loadNews(){
  try{newsSnapshot=await json('news.json')}catch{newsSnapshot={status:'failed'}}
  if(selected&&snapshot)renderBrief(snapshot.games.find(game=>game.id===selected));
}
function renderCoverage(){
  const target=$('coverage');
  if(!target||!snapshot)return;
  const result=summarizeCoverage(snapshot.games,cameraSnapshot,roadSnapshot);
  const label={connected:'Connected snapshot',not_connected:'No connector',source_failed:'Configured source failed',stale:'Stale snapshot',unavailable:'Unavailable',candidate:'Unreviewed point',unmapped:'No point'};
  const ground=groundSnapshot?.byVenue||{};
  target.innerHTML=`<div class="coverage-totals"><div><strong>${result.points}/${result.total}</strong><span>VENUE POINT CANDIDATES</span></div><div><strong>${Object.keys(ground).length}/${result.total}</strong><span>OSM FOOTPRINT CANDIDATES</span></div><div><strong>${result.cameras}/${result.total}</strong><span>CAMERA METADATA FEEDS</span></div><div><strong>${result.roads}/${result.total}</strong><span>ROAD CONDITION FEEDS</span></div></div>`+
    `<p>Camera and road counts require a source snapshot built within 12 hours. Ground outlines are dated, one-time research candidates and are not approved perimeters. A connected feed does not verify camera video, a venue view, road impact, or completeness. ${!cameraSnapshot||!roadSnapshot?'Some snapshots are still loading or unavailable.':''}</p>`+
    `<details><summary>Inspect coverage for all ${result.total} venues</summary><div class="coverage-scroll"><table class="coverage-table"><thead><tr><th scope="col">Venue</th><th scope="col">Map point</th><th scope="col">OSM outline</th><th scope="col">Camera metadata</th><th scope="col">Road conditions</th></tr></thead><tbody>${result.rows.map(row=>`<tr><th scope="row">${esc(row.name)}<small>${esc(row.address)}</small></th><td>${esc(label[row.point])}</td><td>${ground[row.id]?'Candidate':'No matched outline'}</td><td>${esc(label[row.camera])}</td><td>${esc(label[row.road])}</td></tr>`).join('')}</tbody></table></div></details>`+
    (result.cameraFailed.length||result.roadFailed.length?`<p>Failed sources: ${esc([...result.cameraFailed,...result.roadFailed].join(', '))}.</p>`:'');
  renderVenueMap(result.rows);
}
function renderVenueMap(rows){
  const target=$('venue-map');
  if(!target||!snapshot)return;
  const markers=venueMarkers(rows,snapshot.games);
  const labels={connected:'connected snapshot',not_connected:'no connector',source_failed:'configured source failed',stale:'stale snapshot',unavailable:'unavailable'};
  target.innerHTML=`<div class="map-scroll"><div class="map-stage">${markers.map(marker=>`<button type="button" class="map-marker ${marker.state}${snapshot.games.find(game=>game.id===selected)?.venue.id===marker.id?' selected':''}" style="left:${marker.x/10}%;top:${marker.y/5.7}%" data-venue-id="${esc(marker.id)}" data-game-id="${esc(marker.gameId)}" title="${esc(marker.name)}" aria-label="${esc(marker.name)}: camera ${esc(labels[marker.camera])}, road ${esc(labels[marker.road])}. Open ${esc(marker.gameTitle||'venue')}"></button>`).join('')}</div></div>`;
  target.querySelectorAll('.map-marker').forEach(button=>button.addEventListener('click',()=>{
    if(!button.dataset.gameId)return;
    selectGame(button.dataset.gameId);
    $('detail').scrollIntoView({block:'start',behavior:'smooth'});
  }));
}
function renderGround(game){
  const target=$('ground');
  if(!target)return;
  if(!groundSnapshot){target.innerHTML='<p>Ground footprint candidate snapshot unavailable.</p>';return}
  const item=groundSnapshot.byVenue?.[game.venue.id];
  if(!item){target.innerHTML=`<p>No qualifying OpenStreetMap polygon candidate for this venue. A stadium ground boundary has not been established. ${link(groundSnapshot.licenseUrl,'OpenStreetMap data')}</p>`;return}
  const rings=item.outerRings||[item.ring],venue=game.venue,inside=rings.some(ring=>pointInsideRing(venue,ring));
  const xs=[...rings.flatMap(ring=>ring.map(point=>point[0])),venue.lon],ys=[...rings.flatMap(ring=>ring.map(point=>point[1])),venue.lat];
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),width=maxX-minX,height=maxY-minY;
  const sx=x=>20+220*(x-minX)/width,sy=y=>240-220*(y-minY)/height;
  const outline=rings.map(ring=>ring.map(([x,y],index)=>`${index?'L':'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ')+'Z').join(' ');
  const identity=item.identityMethod==='exact_name'?'Exact mapped-name match without a Wikidata tag; identity requires review.':'Wikidata identity match.';
  const components=rings.length>1?` ${rings.length} separate outer components are shown.`:'';
  const holes=item.innerRingCount?` ${item.innerRingCount} mapped interior hole(s) are omitted from this sketch and area estimate.`:'';
  target.innerHTML=`<p class="feed-state">UNREVIEWED OSM FOOTPRINT CANDIDATE · SOURCE EDIT ${esc(fmt(item.sourceEditedAt))}</p><p>Mapped feature: ${esc(Object.entries(item.mappedFeature).map(([key,value])=>key+'='+value).join(', '))}. Approximate outer area ${esc((item.areaM2/1000).toFixed(1))} thousand m².${components}${holes} ${identity} The orange dot is the separate venue point candidate.${inside?'':' <strong class="geometry-warning">The venue point falls outside these mapped polygons; resolve the coordinate mismatch before using either geometry.</strong>'}</p><svg class="ground-ring" viewBox="0 0 260 260" role="img" aria-label="Unreviewed OpenStreetMap stadium outer polygons and separate venue point candidate"><path d="${outline}"/><circle cx="${sx(venue.lon).toFixed(1)}" cy="${sy(venue.lat).toFixed(1)}" r="5"/></svg><p>Community mapped building or stadium geometry is a research candidate. It is not an operator-approved ground security perimeter, property line, camera coverage area, gate, parking zone, or active geofence. Source version ${esc(item.sourceVersion)}. ${link(item.sourceUrl,'OSM feature')} · © ${link(groundSnapshot.licenseUrl,'OpenStreetMap contributors / ODbL')}</p>`;
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
  const target=$('airspace');
  if(!target)return;
  if(!seamsSnapshot){target.innerHTML='<p>FAA SEAMS snapshot unavailable or still loading. Check the FAA source directly.</p>';return}
  const record=seamsSnapshot.byGame?.[game.id];
  if(!record){target.innerHTML=`<p>No linked NFL event in this FAA SEAMS snapshot. This does not establish unrestricted airspace. ${link(seamsSnapshot.sourceItemUrl,'FAA SEAMS')}</p>`;return}
  const age=Date.now()-Date.parse(seamsSnapshot.builtAt),fresh=age>=0&&age<12*3600000;
  const ring=record.ring||[],xs=ring.map(point=>point[0]),ys=ring.map(point=>point[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const sx=x=>20+220*(x-minX)/(maxX-minX),sy=y=>240-220*(y-minY)/(maxY-minY);
  const outline=ring.map(([x,y],index)=>`${index?'L':'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ')+'Z';
  const point=game.venue,venueX=sx(point.lon),venueY=sy(point.lat);
  target.innerHTML=`<p class="feed-state">FAA SEAMS · ${fresh?'SNAPSHOT '+esc(fmt(seamsSnapshot.builtAt)):'SNAPSHOT STALE'}</p><p>FAA-listed ${esc(record.status)} · source window ${esc(fmt(record.startAt))} to ${esc(fmt(record.endAt))}. The restriction boundary is FAA-published airspace geometry centered near the venue; it is not a ground security perimeter. The venue dot is an unreviewed candidate point.</p><svg class="airspace-ring" viewBox="0 0 260 260" role="img" aria-label="FAA SEAMS published airspace boundary and venue candidate point"><path d="${outline}"/><circle cx="${venueX.toFixed(1)}" cy="${venueY.toFixed(1)}" r="5"/></svg><p id="airspace-live">Checking the FAA record for current status…</p><p>FAA sporting-event restrictions generally extend three nautical miles around a qualifying venue from one hour before the event until one hour after it ends. The published event end can change. Verify current NOTAMs before any aviation decision. ${link(seamsSnapshot.sourceItemUrl,'FAA SEAMS source')} · ${link('https://tfr.faa.gov/tfr3/','FAA TFRs')}</p>`;
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
  if(!caltrans&&!wsdot)return '';
  const note=wsdot?'WSDOT says this roadway image updates approximately every 5 minutes. The image may lag or be unavailable; inspect its overlaid time. Page checks every 2 minutes while selected.':'Agency current-image endpoint · may show an unavailable placeholder · check any overlaid timestamp · page checks every 2 minutes while selected';
  return `<div class="camera-image"><img class="camera-still" src="${esc(item.stillUrl)}?t=${Date.now()}" data-src="${esc(item.stillUrl)}" alt="Agency roadway camera image near ${esc(item.name)}" loading="lazy" referrerpolicy="no-referrer"><small>${esc(note)}</small></div>`;
}
const wisdotVideo=url=>/^https:\/\/cctv\d+\.dot\.wi\.gov\/rtplive\/CCTV-\d{2}-\d{4}\/playlist\.m3u8$/.test(url||'');
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
async function playCameraVideo(button,game){
  const url=button.dataset.videoUrl,container=button.nextElementSibling,video=container?.querySelector('video'),status=container?.querySelector('.camera-video-status');
  if(!wisdotVideo(url)||!video||!status)return;
  if(cameraPlayer?.video===video){stopCameraVideo();container.hidden=true;button.textContent='Play public roadway video';return}
  stopCameraVideo();stopCameraFrame();container.hidden=false;button.textContent='Stop public roadway video';status.textContent='Connecting to WisDOT public roadway stream…';
  cameraPlayer={video,hls:null};
  video.onplaying=()=>{if(cameraPlayer?.video===video)status.textContent='Playing agency roadway stream. Capture latency and field of view are not independently verified.'};
  video.onerror=()=>{if(cameraPlayer?.video===video)status.textContent='Stream unavailable. Use the WisDOT camera viewer link.'};
  try{
    if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;await video.play()}
    else{
      const Hls=await loadHls();
      if(selected!==game.id||!button.isConnected||cameraPlayer?.video!==video)return;
      if(!Hls.isSupported())throw Error('Browser does not support HLS playback');
      const hls=new Hls({enableWorker:true,maxBufferLength:20});cameraPlayer.hls=hls;
      hls.on(Hls.Events.MEDIA_ATTACHED,()=>hls.loadSource(url));
      hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{status.textContent='Press play to start the public roadway stream.'}));
      hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&cameraPlayer?.video===video)status.textContent='Stream unavailable. Use the WisDOT camera viewer link.'});
      hls.attachMedia(video);
    }
  }catch{if(cameraPlayer?.video===video)status.textContent='Stream unavailable. Use the WisDOT camera viewer link.'}
}
function renderCameras(game){
  const target=$('cameras');
  if(!target)return;
  stopCameraVideo();
  stopCameraFrame();
  if(cameraRefreshTimer){clearInterval(cameraRefreshTimer);cameraRefreshTimer=null}
  if(!cameraSnapshot){target.innerHTML='<p>Camera metadata snapshot unavailable.</p>';return}
  const sources=cameraSnapshot.sources||[];
  const covered=Object.hasOwn(cameraSnapshot.byVenue||{},game.venue.id);
  const items=covered?cameraSnapshot.byVenue[game.venue.id]:[];
  const failed=sources.filter(source=>source.status==='failed');
  const builtAt=Date.parse(cameraSnapshot.builtAt);
  const stale=!Number.isFinite(builtAt)||Date.now()-builtAt>12*3600000;
  target.innerHTML=`<p class="feed-state">PUBLIC ROADWAY CAMERAS · SNAPSHOT ${esc(fmt(cameraSnapshot.builtAt))}</p>`+
    `<p>${covered?'Nearest agency-listed cameras within 15 km of the venue candidate point. Distance does not establish a stadium view, live image, or access to venue security cameras.':'No connected agency roadway-camera inventory for this venue.'}${game.venue.id==='3738'&&covered?' Massachusetts records come from a public MassDOT staging asset layer with unknown upstream freshness. Live imagery requires separate TrafficLand access; the Mass511 link is a general camera directory.':''}${stale?' This snapshot is more than 12 hours old.':''}</p>`+
    (items.length?items.map(item=>`<div class="camera-row"><strong>${esc(item.name)}</strong><span>${esc(item.agency)} · ${esc(item.distanceKm)} km · ${item.operationalStatus?'source status '+esc(item.operationalStatus):item.inService===null?'service status not supplied':item.inService?'listed in service':'listed out of service'}${item.statusAsOf?' · source cache '+esc(fmt(item.statusAsOf)):''}${item.metadataDate?' · metadata dated '+esc(item.metadataDate):''}</span>${cameraStill(item,stale)}${!stale&&item.agency==='WisDOT 511'&&wisdotVideo(item.videoUrl)?`<button type="button" class="camera-video-toggle" data-video-url="${esc(item.videoUrl)}">Play public roadway video</button><div class="camera-video" hidden><video controls muted playsinline preload="none" aria-label="WisDOT roadway camera near ${esc(item.name)}"></video><small class="camera-video-status">Agency stream not yet started. Camera direction and stadium view are unverified.</small></div>`:''}${!stale&&item.agency==='Maryland CHART'&&item.operationalStatus==='OK'&&marylandViewer(item.viewerUrl)?`<button type="button" class="camera-video-toggle camera-frame-toggle" data-frame-url="${esc(item.viewerUrl)}">Show official CHART video</button><div class="camera-video" hidden><iframe title="Maryland CHART roadway camera near ${esc(item.name)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen" allowfullscreen></iframe><small>Official CHART public viewer. Source status is from its last cache update; playback, latency, field of view and stadium visibility are unverified. No video is stored by Event Atlas.</small></div>`:''}<span>${link(item.viewerUrl,item.viewerKind==='unverified_still'?'Agency image URL (freshness unverified)':item.viewerKind==='directory_only'?'Agency camera directory':'Agency camera viewer')} · ${link(item.sourceUrl,'Metadata source')}</span></div>`).join(''):covered?'<p>No nearby camera metadata in this agency snapshot.</p>':'')+
    (failed.length?`<p>Unavailable source: ${esc(failed.map(source=>source.id).join(', '))}. The displayed coverage may be incomplete.</p>`:'');
  const images=[...target.querySelectorAll('.camera-still')];
  for(const button of target.querySelectorAll('.camera-video-toggle:not(.camera-frame-toggle)'))button.onclick=()=>playCameraVideo(button,game);
  for(const button of target.querySelectorAll('.camera-frame-toggle'))button.onclick=()=>toggleCameraFrame(button);
  for(const img of images)img.addEventListener('error',()=>{img.closest('.camera-image').querySelector('small').textContent='Agency image unavailable. Use the agency viewer.';img.hidden=true});
  if(images.length)cameraRefreshTimer=setInterval(()=>{
    if(selected!==game.id){clearInterval(cameraRefreshTimer);cameraRefreshTimer=null;return}
    for(const img of images)if(!img.hidden)img.src=img.dataset.src+'?t='+Date.now();
  },120000);
}
function renderRoads(game){
  const target=$('roads');
  if(!target)return;
  const roadsData=selectedRoadSnapshot(game);
  if(!roadsData){target.innerHTML='<p>Road condition snapshot unavailable.</p>';return}
  const context=selectRoadContext(game,roadsData);
  const failed=roadsData.sources.filter(source=>source.status==='failed');
  const ilSource=game.venue.address.endsWith('IL, USA')?roadsData.sources.find(source=>source.id==='idot-closure-incidents'):null;
  const wiSource=game.venue.address.endsWith('WI, USA')?roadsData.sources.find(source=>source.id==='wisdot-511-events-green-bay'):null;
  const laSource=game.venue.address.endsWith('LA, USA')?roadsData.sources.find(source=>source.id==='ladotd-511-new-orleans'):null;
  const mnSource=game.venue.address.endsWith('MN, USA')?roadsData.sources.find(source=>source.id==='mndot-iris-incidents'):null;
  const wzdx=/\b(NJ|NC|MO), USA$/.test(game.venue.address);
  const timing={matched:context.overlapCount?`${context.overlapCount} published road-event ${context.overlapCount===1?'window overlaps':'windows overlap'} the illustrative interval from four hours before to five hours after kickoff. Overlap is a review cue, not evidence of route or event impact.`:'No published timed road-event window in this snapshot overlaps the illustrative kickoff interval. Agency-listed incidents and closures without end times cannot be matched to kickoff.',no_coverage:'No connected agency road-condition feed for this venue; event-time matching is unavailable.',stale:'Snapshot is more than 12 hours old; event-time matching is disabled.',cancelled:'Game is cancelled in source; event-time matching is disabled.',kickoff_tbd:'Kickoff time is TBD; event-time matching is disabled.',past_or_invalid:'Kickoff is past or invalid; current road data is not matched to this game.',source_listed_only:context.records.length?wzdx?'Publisher-listed WZDx work zones are nearby spatial context; published dates are not verified as active work at kickoff.':mnSource?'MnDOT IRIS lists current roadway incidents near the venue candidate point. The snapshot does not establish whether any will remain active at kickoff.':'Tennessee SmartWay events are source-listed road context. Open-ended and recurring records are not matched to kickoff.':wzdx?'The WZDx feed returned no qualifying nearby work zones in this snapshot; road conditions cannot be inferred from that absence.':mnSource?'The MnDOT IRIS feed returned no nearby active roadway incidents in this snapshot; road conditions cannot be inferred from that absence.':'Tennessee SmartWay query returned no qualifying nearby records in this snapshot; road conditions cannot be inferred from that absence.',outside_window:'Kickoff is outside this source’s published-window comparison period; event-time matching is unavailable.'}[context.timingState];
  target.innerHTML=`<p class="feed-state">AGENCY ROAD CONDITIONS · SNAPSHOT ${esc(fmt(roadsData.builtAt))}${roadsData.directCheck?' · DIRECT TDOT CHECK':''}</p><p>${esc(timing)}${context.timingState==='no_coverage'?'':context.timingState==='source_listed_only'?wzdx?' WZDx records are within 10 km of the unreviewed venue point; verify with the road agency before travel decisions.':` The query is limited to 10 km around the unreviewed venue point; verify with ${mnSource?'MnDOT':'Tennessee DOT'} before travel decisions.`:' Published records are within 10 km of the venue candidate point. Dates and times display in your browser time zone; verify with the road agency before travel decisions.'}${ilSource?.sourceUpdatedAt?' Illinois DOT layer last edited '+esc(fmt(ilSource.sourceUpdatedAt))+'.':''}${wiSource?.sourceUpdatedAt?' WisDOT 511 layer last edited '+esc(fmt(wiSource.sourceUpdatedAt))+'. Recurrence descriptions are not expanded beyond each structured event window.':''}${laSource?.sourceUpdatedAt?' Louisiana DOTD service last updated '+esc(fmt(laSource.sourceUpdatedAt))+'. Historical and undated events are excluded.':''}${mnSource?.sourceUpdatedAt?' MnDOT IRIS feed last modified '+esc(fmt(mnSource.sourceUpdatedAt))+'.':''}</p>${context.records.length?context.records.map(item=>`<div class="camera-row"><strong>${item.overlaps?'<span class="time-match">TIME OVERLAP · REVIEW</span> ':''}${esc(item.kind)} · ${esc(item.name)}</strong><span>${esc(item.agency)} · ${esc(item.distanceKm)} km${item.timed?' · '+esc(fmt(item.startAt))+' to '+esc(fmt(item.endAt)):item.timingPolicy==='source_listed_only'?' · event-time match not assessed':' · no structured event window'}${item.sourceRecordDate?' · source record '+esc(item.sourceRecordDate):''}${item.sourceReportedBy?' · source field '+esc(item.sourceReportedBy):''}</span><span>${esc(item.detail)}</span>${link(item.sourceUrl,'Agency source')}</div>`).join(''):'<p>No nearby road condition records in the connected agency snapshots for this venue.</p>'}${game.venue.id==='3810'&&liveTennesseeRoad?.state==='failed'?'<p>Direct Tennessee DOT check failed; showing the last scheduled snapshot if available. Verify with the agency.</p>':''}${failed.length?`<p>Unavailable source: ${esc(failed.map(source=>source.id).join(', '))}. Coverage may be incomplete.</p>`:''}`;
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
      context.alerts.slice(0,5).map(item=>`<div class="camera-row"><strong>${item.eventWindowOverlap?'EVENT-TIME OVERLAP · REVIEW · ':''}${esc(item.header)}</strong><span>${esc(item.effect)} · ${esc(item.lifecycle)} · ${item.periods.map(period=>`${esc(fmt(period.start))} to ${period.end?esc(fmt(period.end)):'open-ended in source'}`).join('; ')}</span>${link(item.sourceUrl,'MBTA alert record')}</div>`).join('')+
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
      context.entries.slice(0,8).map(item=>`<div class="camera-row"><strong>${esc(item.headsign||'MBTA commuter rail trip')}</strong><span>${item.arrivalAt?'Predicted arrival '+esc(fmt(item.arrivalAt)):''}${item.arrivalAt&&item.departureAt?' · ':''}${item.departureAt?'Predicted departure '+esc(fmt(item.departureAt)):''}${item.status?' · '+esc(item.status):''}</span>${link(item.sourceUrl,'MBTA trip record')}</div>`).join('')+
      `<p>Predictions are estimates for station service now; zero records do not mean the game train is cancelled or that no later service will run. No train position or venue impact is inferred. ${link(context.sourceUrl,'MBTA current predictions')}</p>`;
  }catch(error){if(selected!==game.id)return;mbtaPredictions={state:'failed',checkedAt:Date.now()};renderBrief(game);target.innerHTML=`<p>MBTA Foxboro predictions unavailable or invalid (${esc(error.message)}). No service conclusion can be inferred. ${link(mbtaFoxboroPredictionsUrl,'MBTA predictions')}</p>`}
}
function renderTransit(game){
  const target=$('transit');if(!target)return;
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
  if(game.venue.id!=='3687'){
    briefPolice=null;
    target.innerHTML='<p>No connected jurisdictional police incident source for this venue. This is a coverage gap, not a finding that no incidents exist.</p>';
    return;
  }
  async function refresh(){
    try{
      const feed=await json(arlingtonQuery),checkedAt=Date.now();
      if(selected!==game.id)return;
      const context=summarizeArlingtonCalls(feed,game.venue,game,checkedAt);
      briefPolice={state:'retrieved',checkedAt,context};renderBrief(game);
      target.innerHTML=`<p class="feed-state">ARLINGTON POLICE INCIDENT LAYER · CHECKED ${esc(fmt(checkedAt))}</p><p>${context.nearby} publicly listed call${context.nearby===1?'':'s'} within 5 km of the unreviewed AT&amp;T Stadium point and dated in the past 12 hours.${context.gameWindowCurrent?' '+context.windowCount+' of these fall in the illustrative interval from four hours before to five hours after kickoff. This is a review cue only.':''} ${context.newestUpdate?'Newest included record update: '+esc(fmt(context.newestUpdate))+'.':''}</p><p>The city delays calls by at least 60 minutes and refreshes its public display every 15 minutes. Records may be open or closed, omit incidents, or change. This area count does not establish a stadium incident, risk level, police alert, or threat. The app does not publish incident locations or call details. ${link('https://policeincidents.arlingtontx.gov/','City public viewer')} · ${link(arlingtonSource,'City data layer')}</p>`;
    }catch(error){if(selected===game.id){briefPolice={state:'failed'};renderBrief(game);target.innerHTML=`<p>Arlington police incident layer unavailable or incomplete (${esc(error.message)}). No negative finding can be inferred. ${link('https://policeincidents.arlingtontx.gov/','City public viewer')}</p>`}}
  }
  target.innerHTML='<p>Checking Arlington’s delayed public incident layer…</p>';
  refresh();
  publicSafetyRefreshTimer=setInterval(()=>{if(selected===game.id)refresh();else{clearInterval(publicSafetyRefreshTimer);publicSafetyRefreshTimer=null}},300000);
}
function selectGame(id){clearInterval(exercisePlaybackTimer);exercisePlaybackTimer=null;clearInterval(transitRefreshTimer);transitRefreshTimer=null;selected=id;exerciseStage=0;briefConditions=null;briefPolice=null;cmpdTraffic=null;mbtaTransit=null;mbtaSchedule=null;mbtaPredictions=null;liveTennesseeRoad=null;if(tennesseeRoadRefreshTimer){clearInterval(tennesseeRoadRefreshTimer);tennesseeRoadRefreshTimer=null}if(briefRefreshTimer)clearInterval(briefRefreshTimer);if(conditionsRefreshTimer)clearInterval(conditionsRefreshTimer);conditionsRequestSerial++;renderList();const game=snapshot.games.find(item=>item.id===id);if(!game)return;const venue=game.venue,point=Number.isFinite(venue.lat)&&Number.isFinite(venue.lon);$('venue-map')?.querySelectorAll('.map-marker').forEach(button=>button.classList.toggle('selected',button.dataset.venueId===venue.id));$('detail').innerHTML=`<span class="tag">WEEK ${game.week} · ${esc(game.status.toUpperCase())}</span><h3>${esc(game.title)}</h3><p class="detail-sub">${esc(gameTime(game))}</p><div class="facts">${fact('VENUE',venue.name)}${fact('LOCATION',venue.address)}${fact('SOURCE VENUE ID',venue.id)}${fact('MAP POINT',point?venue.lat.toFixed(5)+', '+venue.lon.toFixed(5):'Not verified')}</div><div class="detail-section"><h4>Schedule & venue provenance</h4><p>ESPN scoreboard ID ${esc(game.id)}. Retrieved ${esc(fmt(game.sourceRetrievedAt))}. Game and venue may change; confirm with the NFL or host club.</p><p>Venue coordinate: ${esc(venue.coordinateStatus)}. ${point?'A name match is not an entrance, footprint, or operational asset.':'No point-specific feed is queried for this venue.'}</p>${link(game.sourceUrl,'ESPN game')}${venue.venueCandidateUrl?' · '+link(venue.venueCandidateUrl,'Wikidata venue candidate'):''}</div><div class="detail-section event-picture-section"><h4>Public-source event picture</h4><div id="event-picture"><p>Assembling source status…</p></div></div><div class="detail-section exercise-section"><h4>Threat briefing exercise</h4><div id="exercise"></div></div><div class="detail-section"><h4>Ground footprint candidate</h4><div id="ground"><p>Loading mapped ground geometry…</p></div></div><div class="detail-section"><h4>Airspace and geofence</h4><div id="airspace"><p>Loading FAA SEAMS…</p></div></div><div class="detail-section"><h4>FAA TFR and NOTAM review</h4><div id="tfr"><p>Loading FAA TFR list…</p></div></div><div class="detail-section"><h4>Public conditions</h4><p>NWS alerts and USGS observations are rechecked about every five minutes while this game is open. A failed check is shown as unavailable.</p><button id="conditions-refresh" type="button">Check public conditions now</button><div id="conditions"><p>Loading current public feeds…</p></div></div><div class="detail-section"><h4>Public safety activity</h4><div id="public-safety"><p>Checking jurisdictional coverage…</p></div></div><div class="detail-section"><h4>Transit alerts and published service</h4><div id="transit"><p>Checking station coverage…</p></div></div><div class="detail-section"><h4>Roadway camera sources</h4><div id="cameras"><p>Loading camera metadata…</p></div></div><div class="detail-section"><h4>Road conditions</h4><div id="roads"><p>Loading agency road conditions…</p></div></div>`;renderGround(game);renderAirspace(game);renderTfr(game);renderCameras(game);renderRoads(game);renderPublicSafety(game);renderTransit(game);renderBrief(game);renderExercise(game);if(game.venue.id==='3810'){refreshTennesseeRoad(game);tennesseeRoadRefreshTimer=setInterval(()=>{if(selected===id)refreshTennesseeRoad(game)},300000)}briefRefreshTimer=setInterval(()=>{if(selected===id)renderBrief(game)},60000);if(point){$('conditions-refresh').onclick=()=>loadConditions(game,true);loadConditions(game);conditionsRefreshTimer=setInterval(()=>{if(selected===id&&document.visibilityState==='visible'&&(!briefConditions||Date.now()-briefConditions.at>=300000))loadConditions(game)},60000)}else{$('conditions-refresh').disabled=true;$('conditions').innerHTML='<p>Point-specific feeds unavailable because the venue map point has not been verified.</p>'}}
async function loadConditions(game,force=false){
  if(conditionsPendingFor?.id===game.id&&conditionsPendingFor.serial===conditionsRequestSerial)return;
  const venue=game.venue,target=$('conditions'),id=game.id,key=venue.id,requestSerial=++conditionsRequestSerial,button=$('conditions-refresh');
  conditionsPendingFor={id,serial:requestSerial};if(button){button.disabled=true;button.textContent='Checking public conditions…'}
  try{
  const nwsUrl='https://api.weather.gov/alerts/active?point='+venue.lat+','+venue.lon;
  let result=cache.get(key);
  if(force||!result||Date.now()-result.at>=300000){
    const usgs='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
    const responses=await Promise.allSettled([json(nwsUrl,12000),json(usgs,12000)]);
    const nws=responses[0].status==='fulfilled'?responses[0].value:null;
    result={at:Date.now(),alerts:Array.isArray(nws?.features)?nws:null,
      alertsError:responses[0].status==='rejected'?String(responses[0].reason):!Array.isArray(nws?.features)?'Invalid NWS alert response':null,
      quakes:responses[1].status==='fulfilled'?responses[1].value:null,
      quakesError:responses[1].status==='rejected'?String(responses[1].reason):null};
    if(selected===id&&requestSerial===conditionsRequestSerial)cache.set(key,result);
  }
  if(selected!==id||requestSerial!==conditionsRequestSerial)return;
  briefConditions=result;renderBrief(game);
  const weather=selectWeatherContext(game,result.alerts?.features,result.at);
  const quakes=(result.quakes?.features||[]).filter(item=>{
    const [lon,lat]=item.geometry?.coordinates||[];
    return Number.isFinite(lat)&&distance(venue.lat,venue.lon,lat,lon)<=250;
  }).sort((a,b)=>{
    const [alon,alat]=a.geometry.coordinates,[blon,blat]=b.geometry.coordinates;
    return distance(venue.lat,venue.lon,alat,alon)-distance(venue.lat,venue.lon,blat,blon);
  }).slice(0,3);
  const weatherNote=weather.state==='stale'?'Alert retrieval is older than five minutes; game-time screening is disabled.':
    weather.state==='kickoff_unavailable'?'Kickoff is TBD, the illustrative game interval has passed, or the game is cancelled in source; game-time screening is disabled.':
    weather.candidateCount?`${weather.candidateCount} NWS severe or extreme alert(s) with immediate or expected urgency overlap the illustrative game interval. Analyst review is required; this is not a threat assessment.`:
    weather.alerts.length?'No returned alert met the game-time screening criteria. This does not establish the absence of hazards or threats.':'No active alert returned for the venue candidate point. This does not establish the absence of hazards or threats.';
  target.innerHTML=`<p class="feed-state">NWS ACTIVE ALERTS · ${result.alertsError?'UNAVAILABLE':'RETRIEVED '+esc(fmt(result.at))}</p>`+
    (result.alertsError?`<p>${esc(result.alertsError)}. No negative finding can be inferred.</p>`:
      `<p>${esc(weatherNote)} NWS alerts are queried for the venue candidate point; confirm footprint and validity with NWS. ${link(nwsUrl,'NWS point feed')}</p>`+
      weather.alerts.map(({feature:item,candidate})=>`<div class="alert"><strong>${candidate?'<span class="time-match">TIME-ALIGNED NWS ALERT · REVIEW</span> ':''}${esc(item.properties?.event||'Alert')}</strong><br>${esc(item.properties?.severity||'Severity not supplied')} · ${esc(item.properties?.urgency||'Urgency not supplied')} · ${item.properties?.effective?esc(fmt(item.properties.effective)):'start not supplied'} to ${item.properties?.ends||item.properties?.expires?esc(fmt(item.properties.ends||item.properties.expires)):'end not supplied'} · ${link(item.properties?.['@id']||item.id,'NWS source')}</div>`).join(''))+
    `<p class="feed-state">USGS EARTHQUAKES · ${result.quakesError?'UNAVAILABLE':'RETRIEVED '+esc(fmt(result.at))+' · PAST SEVEN DAYS'}</p>`+
    (result.quakesError?`<p>${esc(result.quakesError)}</p>`:quakes.length?quakes.map(item=>`<p>${esc(item.properties?.title)} · ${link(item.properties?.url,'USGS record')}</p>`).join(''):'<p>No magnitude 2.5+ event returned within 250 km. Proximity alone does not establish impact.</p>')+
    '<div id="forecast"><p>Checking the NWS kickoff forecast window…</p></div>';
  loadForecast(game,requestSerial);
  }finally{if(conditionsPendingFor?.serial===requestSerial)conditionsPendingFor=null;if(selected===id&&requestSerial===conditionsRequestSerial&&button){button.disabled=false;button.textContent='Check public conditions now'}}
}
async function loadForecast(game,requestSerial){if(selected!==game.id||requestSerial!==conditionsRequestSerial)return;const target=$('forecast'),venue=game.venue,kickoff=Date.parse(game.kickoff),hours=(kickoff-Date.now())/3600000;if(game.timeTbd){target.innerHTML='<p class="feed-state">KICKOFF FORECAST · TIME TBD</p><p>Forecast matching starts when a kickoff time is published.</p>';return}if(hours<0||hours>168){target.innerHTML='<p class="feed-state">KICKOFF FORECAST · OUTSIDE WINDOW</p><p>NWS hourly forecasts cover approximately seven days ahead.</p>';return}try{const point=await json('https://api.weather.gov/points/'+venue.lat+','+venue.lon),url=point.properties?.forecastHourly;if(!url||new URL(url).origin!=='https://api.weather.gov')throw Error('NWS hourly link unavailable');const forecast=await json(url),period=forecast.properties?.periods?.find(item=>Date.parse(item.startTime)<=kickoff&&kickoff<Date.parse(item.endTime));if(selected!==game.id||requestSerial!==conditionsRequestSerial)return;target.innerHTML=period?`<p class="feed-state">KICKOFF FORECAST · NWS HOURLY</p><p>${esc(period.shortForecast)} · ${esc(period.temperature)}°${esc(period.temperatureUnit)} · Wind ${esc(period.windSpeed)} ${esc(period.windDirection)} · Precipitation ${period.probabilityOfPrecipitation?.value==null?'not supplied':esc(period.probabilityOfPrecipitation.value)+'%'}</p><p>${link(url,'NWS forecast')} · Forecast may change; check again close to kickoff.</p>`:'<p>NWS supplied no hourly period covering kickoff.</p>'}catch(error){if(selected===game.id&&requestSerial===conditionsRequestSerial)target.innerHTML=`<p class="feed-state">KICKOFF FORECAST · UNAVAILABLE</p><p>${esc(error.message)}</p>`}}
async function refreshPublishedSnapshots(){
  if(!snapshot||publicationRefreshPending||Date.now()-lastPublicationCheckAt<300000)return;
  publicationRefreshPending=true;lastPublicationCheckAt=Date.now();
  const feeds=[
    {id:'schedule',file:'nfl.json',key:'games',get:()=>snapshot,set:value=>{snapshot=value}},
    {id:'ground',file:'ground_footprints.json',key:'byVenue',get:()=>groundSnapshot,set:value=>{groundSnapshot=value}},
    {id:'cameras',file:'cameras.json',key:'byVenue',get:()=>cameraSnapshot,set:value=>{cameraSnapshot=value}},
    {id:'roads',file:'roads.json',key:'byVenue',get:()=>roadSnapshot,set:value=>{roadSnapshot=value}},
    {id:'airspace',file:'seams.json',key:'byGame',get:()=>seamsSnapshot,set:value=>{seamsSnapshot=value}},
    {id:'tfr',file:'tfr.json',key:'byVenue',get:()=>tfrSnapshot,set:value=>{tfrSnapshot=value}}
  ];
  try{
    const results=await Promise.allSettled(feeds.map(feed=>json(feed.file,15000)));
    const changed=new Set(),unavailable=[];
    for(let i=0;i<feeds.length;i++){
      const feed=feeds[i],result=results[i];
      if(result.status==='rejected'||!result.value?.[feed.key]||typeof result.value[feed.key]!=='object'){
        unavailable.push(feed.id);continue;
      }
      if(feed.id==='schedule'&&!result.value.source?.status){unavailable.push(feed.id);continue}
      if(shouldAdoptPublishedSnapshot(feed.get(),result.value,feed.key)){
        feed.set(result.value);changed.add(feed.id);
      }
    }
    $('freshness').textContent=`Built ${fmt(snapshot.builtAt)} · published sources checked ${fmt(Date.now())}${unavailable.length?' · refresh unavailable: '+unavailable.join(', '):''}`;
    if(changed.has('schedule')){
      const games=snapshot.games,next=sorted(games.slice()).find(game=>Date.parse(game.kickoff)>=Date.now());
      $('game-count').textContent=games.length.toLocaleString();
      $('venue-count').textContent=new Set(games.map(game=>game.venue.id)).size;
      $('next-kickoff').textContent=next?fmt(next.kickoff):'Season complete';
      $('source-state').textContent=snapshot.source.status.toUpperCase();
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
      if(changed.has('airspace'))renderAirspace(game);
      if(changed.has('tfr'))renderTfr(game);
      if(changed.size)renderBrief(game);
    }
  }finally{publicationRefreshPending=false}
}
async function init(){loadNtas();loadNews();try{snapshot=await json('nfl.json');const games=snapshot.games,venues=new Set(games.map(game=>game.venue.id)),next=sorted(games.slice()).find(game=>Date.parse(game.kickoff)>=Date.now());$('game-count').textContent=games.length.toLocaleString();$('venue-count').textContent=venues.size;$('next-kickoff').textContent=next?fmt(next.kickoff):'Season complete';$('source-state').textContent=snapshot.source.status.toUpperCase();$('freshness').textContent='Built '+fmt(snapshot.builtAt);$('week').innerHTML+=Array.from({length:18},(_,index)=>`<option value="${index+1}">Week ${index+1}</option>`).join('');$('search').oninput=renderList;$('week').onchange=renderList;$('time').onchange=renderList;renderList();renderCoverage();if(next)selectGame(next.id);try{indyPoliceSnapshot=await json('indianapolis_public_safety.json')}catch{indyPoliceSnapshot={status:'error'}}if(selected)renderPublicSafety(games.find(game=>game.id===selected));try{charlottePoliceSnapshot=await json('charlotte_public_safety.json')}catch{charlottePoliceSnapshot={status:'error'}}if(selected)renderPublicSafety(games.find(game=>game.id===selected));try{groundSnapshot=await json('ground_footprints.json')}catch{groundSnapshot=null}renderCoverage();if(selected)renderGround(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{cameraSnapshot=await json('cameras.json')}catch{cameraSnapshot=null}renderCoverage();if(selected)renderCameras(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{roadSnapshot=await json('roads.json')}catch{roadSnapshot=null}renderCoverage();if(selected)renderRoads(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{seamsSnapshot=await json('seams.json')}catch{seamsSnapshot=null}if(selected)renderAirspace(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected));try{tfrSnapshot=await json('tfr.json')}catch{tfrSnapshot=null}if(selected)renderTfr(games.find(game=>game.id===selected));if(selected)renderBrief(games.find(game=>game.id===selected))}catch(error){$('games').innerHTML=`<p class="empty" style="padding:20px">Schedule unavailable: ${esc(error.message)}</p>`;$('freshness').textContent='Source unavailable'}}
init();
setInterval(()=>{if(document.visibilityState==='visible'){refreshPublishedSnapshots();loadNews();loadNtas()}},300000);

document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||!snapshot||!selected)return;refreshPublishedSnapshots();loadNews();loadNtas();const game=snapshot.games.find(item=>item.id===selected);if(game&&Number.isFinite(game.venue.lat)&&Number.isFinite(game.venue.lon)&&(!briefConditions||Date.now()-briefConditions.at>=300000))loadConditions(game)});
