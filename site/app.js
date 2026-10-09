import {selectRoadContext} from './road_relevance.js?v=20261009-2';
import {selectWeatherContext} from './weather_relevance.js';
import {summarizeCoverage} from './coverage_summary.js?v=20261009-5';
import {venueMarkers} from './venue_map.js?v=20261009-1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const gameTime=game=>game.timeTbd?new Date(game.kickoff).toLocaleDateString(undefined,{dateStyle:'medium',timeZone:'America/New_York'})+' · kickoff TBD':fmt(game.kickoff);
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};
const cache=new Map();let snapshot,cameraSnapshot,roadSnapshot,selected,cameraRefreshTimer;
async function json(url){const local=new URL(url,location.href).origin===location.origin;const result=await fetch(url,{headers:{Accept:'application/geo+json, application/json'},cache:local?'no-store':'default'});if(!result.ok)throw Error('HTTP '+result.status);return result.json()}
function sorted(games){const now=Date.now(),upcoming=$('time').value==='upcoming';return games.sort((a,b)=>{const at=Date.parse(a.kickoff),bt=Date.parse(b.kickoff);if(!upcoming)return at-bt;const af=at>=now,bf=bt>=now;return af!==bf?af?-1:1:af?at-bt:bt-at})}
function renderList(){const q=$('search').value.trim().toLowerCase(),week=$('week').value;const items=sorted(snapshot.games.filter(game=>(!week||String(game.week)===week)&&(!q||[game.title,game.venue.name,game.venue.address].some(value=>value.toLowerCase().includes(q)))));$('result-count').textContent=items.length+' games';$('games').innerHTML=items.length?items.map(game=>`<button class="game ${game.id===selected?'selected':''}" data-id="${esc(game.id)}"><span class="game-top"><span>WEEK ${game.week}</span><span class="date">${esc(gameTime(game))}</span></span><strong>${esc(game.title)}</strong><small>${esc(game.venue.name)} · ${esc(game.venue.address)}</small></button>`).join(''):'<p class="empty" style="padding:20px">No games match these filters.</p>';for(const button of $('games').querySelectorAll('.game'))button.onclick=()=>selectGame(button.dataset.id)}
function fact(label,value){return `<div class="fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`}
function link(url,label){try{const parsed=new URL(url);if(parsed.protocol!=='https:')return '';return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`}catch{return ''}}
async function loadNtas(){
  const target=$('ntas');
  try{
    const feed=await json('ntas.json'),age=Date.now()-Date.parse(feed.retrievedAt);
    if(feed.status!=='ok'||!Number.isFinite(age)||age>12*3600000||age<0){
      target.innerHTML=`<p>Advisory snapshot unavailable or more than 12 hours old. Check ${link(feed.sourceUrl||'https://www.dhs.gov/ntas/1.1/feed.xml','DHS NTAS')} directly.</p>`;
      return;
    }
    target.innerHTML=`<p class="feed-state">DHS FEED RETRIEVED ${esc(fmt(feed.retrievedAt))} · ${esc(feed.activeCount)} ACTIVE ENTRIES</p>`+
      (feed.activeCount?feed.active.map(item=>`<div class="camera-row"><strong>${esc(item.type)}</strong><span>Published interval ${esc(fmt(item.start))} to ${esc(fmt(item.end))}${item.locations?.length?' · Listed locations: '+esc(item.locations.join(', ')):''}${item.sectors?.length?' · Listed sectors: '+esc(item.sectors.join(', ')):''}</span><span>${esc(item.summary)}</span>${link(item.url,'DHS advisory')}</div>`).join(''):'<p>The DHS feed returned no active entries at this snapshot time.</p>')+
      `<p>National advisories are context, not a finding about any NFL game or venue. A zero-entry feed does not establish absence of threats. ${link(feed.sourceUrl,'DHS feed')}</p>`;
  }catch{
    target.innerHTML=`<p>Advisory snapshot unavailable. Check ${link('https://www.dhs.gov/ntas/1.1/feed.xml','DHS NTAS')} directly.</p>`;
  }
}
function renderCoverage(){
  const target=$('coverage');
  if(!target||!snapshot)return;
  const result=summarizeCoverage(snapshot.games,cameraSnapshot,roadSnapshot);
  const label={connected:'Connected snapshot',not_connected:'No connector',source_failed:'Configured source failed',stale:'Stale snapshot',unavailable:'Unavailable',candidate:'Unreviewed point',unmapped:'No point'};
  target.innerHTML=`<div class="coverage-totals"><div><strong>${result.points}/${result.total}</strong><span>VENUE POINT CANDIDATES</span></div><div><strong>${result.cameras}/${result.total}</strong><span>CAMERA METADATA FEEDS</span></div><div><strong>${result.roads}/${result.total}</strong><span>ROAD CONDITION FEEDS</span></div></div>`+
    `<p>Counts require a source snapshot built within 12 hours. A connected feed does not verify camera video, a venue view, road impact, or completeness. ${!cameraSnapshot||!roadSnapshot?'Some snapshots are still loading or unavailable.':''}</p>`+
    `<details><summary>Inspect coverage for all ${result.total} venues</summary><div class="coverage-scroll"><table class="coverage-table"><thead><tr><th scope="col">Venue</th><th scope="col">Map point</th><th scope="col">Camera metadata</th><th scope="col">Road conditions</th></tr></thead><tbody>${result.rows.map(row=>`<tr><th scope="row">${esc(row.name)}<small>${esc(row.address)}</small></th><td>${esc(label[row.point])}</td><td>${esc(label[row.camera])}</td><td>${esc(label[row.road])}</td></tr>`).join('')}</tbody></table></div></details>`+
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
function renderCameras(game){
  const target=$('cameras');
  if(!target)return;
  if(cameraRefreshTimer){clearInterval(cameraRefreshTimer);cameraRefreshTimer=null}
  if(!cameraSnapshot){target.innerHTML='<p>Camera metadata snapshot unavailable.</p>';return}
  const sources=cameraSnapshot.sources||[];
  const covered=Object.hasOwn(cameraSnapshot.byVenue||{},game.venue.id);
  const items=covered?cameraSnapshot.byVenue[game.venue.id]:[];
  const failed=sources.filter(source=>source.status==='failed');
  const builtAt=Date.parse(cameraSnapshot.builtAt);
  const stale=!Number.isFinite(builtAt)||Date.now()-builtAt>12*3600000;
  target.innerHTML=`<p class="feed-state">PUBLIC ROADWAY CAMERAS · SNAPSHOT ${esc(fmt(cameraSnapshot.builtAt))}</p>`+
    `<p>${covered?'Nearest agency-listed cameras within 15 km of the venue candidate point. Distance does not establish a stadium view, live image, or access to venue security cameras.':'No connected agency roadway-camera inventory for this venue.'}${stale?' This snapshot is more than 12 hours old.':''}</p>`+
    (items.length?items.map(item=>`<div class="camera-row"><strong>${esc(item.name)}</strong><span>${esc(item.agency)} · ${esc(item.distanceKm)} km · ${item.operationalStatus?'source status '+esc(item.operationalStatus):item.inService===null?'service status not supplied':item.inService?'listed in service':'listed out of service'}${item.statusAsOf?' · source cache '+esc(fmt(item.statusAsOf)):''}${item.metadataDate?' · metadata dated '+esc(item.metadataDate):''}</span>${!stale&&item.inService===true&&/^https:\/\/cwwp2\.dot\.ca\.gov\/data\/d[47]\/cctv\/image\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg$/.test(item.stillUrl||'')?`<div class="camera-image"><img class="camera-still" src="${esc(item.stillUrl)}?t=${Date.now()}" data-src="${esc(item.stillUrl)}" alt="Current-image endpoint for Caltrans roadway camera ${esc(item.name)}" loading="lazy" referrerpolicy="no-referrer"><small>Agency current-image endpoint · may show an unavailable placeholder · check any overlaid timestamp · refreshed every 2 minutes while selected</small></div>`:''}<span>${link(item.viewerUrl,item.viewerKind==='unverified_still'?'Agency image URL (freshness unverified)':'Agency camera viewer')} · ${link(item.sourceUrl,'Metadata source')}</span></div>`).join(''):covered?'<p>No nearby camera metadata in this agency snapshot.</p>':'')+
    (failed.length?`<p>Unavailable source: ${esc(failed.map(source=>source.id).join(', '))}. The displayed coverage may be incomplete.</p>`:'');
  const images=[...target.querySelectorAll('.camera-still')];
  for(const img of images)img.addEventListener('error',()=>{img.closest('.camera-image').querySelector('small').textContent='Agency image unavailable. Use the agency viewer.';img.hidden=true});
  if(images.length)cameraRefreshTimer=setInterval(()=>{
    if(selected!==game.id){clearInterval(cameraRefreshTimer);cameraRefreshTimer=null;return}
    for(const img of images)if(!img.hidden)img.src=img.dataset.src+'?t='+Date.now();
  },120000);
}
function renderRoads(game){
  const target=$('roads');
  if(!target)return;
  if(!roadSnapshot){target.innerHTML='<p>Road condition snapshot unavailable.</p>';return}
  const context=selectRoadContext(game,roadSnapshot);
  const failed=roadSnapshot.sources.filter(source=>source.status==='failed');
  const ilSource=game.venue.address.endsWith('IL, USA')?roadSnapshot.sources.find(source=>source.id==='idot-closure-incidents'):null;
  const wiSource=game.venue.address.endsWith('WI, USA')?roadSnapshot.sources.find(source=>source.id==='wisdot-511-events-green-bay'):null;
  const timing={matched:context.overlapCount?`${context.overlapCount} published closure ${context.overlapCount===1?'window overlaps':'windows overlap'} the illustrative interval from four hours before to five hours after kickoff. Overlap is a review cue, not evidence of route or event impact.`:'No published timed closure window in this snapshot overlaps the illustrative kickoff interval. Current agency-listed incidents and closures without end times cannot be matched to kickoff.',no_coverage:'No connected agency road-condition feed for this venue; event-time matching is unavailable.',stale:'Snapshot is more than 12 hours old; event-time matching is disabled.',kickoff_tbd:'Kickoff time is TBD; event-time matching is disabled.',past_or_invalid:'Kickoff is past or invalid; current road data is not matched to this game.',outside_window:'Kickoff is outside this source’s published-window comparison period; event-time matching is unavailable.'}[context.timingState];
  target.innerHTML=`<p class="feed-state">AGENCY ROAD CONDITIONS · SNAPSHOT ${esc(fmt(roadSnapshot.builtAt))}</p><p>${esc(timing)}${context.timingState==='no_coverage'?'':' Published records are within 10 km of the venue candidate point. Dates and times display in your browser time zone; verify with the road agency before travel decisions.'}${ilSource?.sourceUpdatedAt?' Illinois DOT layer last edited '+esc(fmt(ilSource.sourceUpdatedAt))+'.':''}${wiSource?.sourceUpdatedAt?' WisDOT 511 layer last edited '+esc(fmt(wiSource.sourceUpdatedAt))+'. Recurrence descriptions are not expanded beyond each structured event window.':''}</p>${context.records.length?context.records.map(item=>`<div class="camera-row"><strong>${item.overlaps?'<span class="time-match">TIME OVERLAP · REVIEW</span> ':''}${esc(item.kind)} · ${esc(item.name)}</strong><span>${esc(item.agency)} · ${esc(item.distanceKm)} km${item.timed?' · '+esc(fmt(item.startAt))+' to '+esc(fmt(item.endAt)):' · no structured event window'}${item.sourceRecordDate?' · source record '+esc(item.sourceRecordDate):''}${item.sourceReportedBy?' · source field '+esc(item.sourceReportedBy):''}</span><span>${esc(item.detail)}</span>${link(item.sourceUrl,'Agency source')}</div>`).join(''):'<p>No nearby road condition records in the connected agency snapshots for this venue.</p>'}${failed.length?`<p>Unavailable source: ${esc(failed.map(source=>source.id).join(', '))}. Coverage may be incomplete.</p>`:''}`;
}
function selectGame(id){selected=id;renderList();const game=snapshot.games.find(item=>item.id===id);if(!game)return;const venue=game.venue,point=Number.isFinite(venue.lat)&&Number.isFinite(venue.lon);$('venue-map')?.querySelectorAll('.map-marker').forEach(button=>button.classList.toggle('selected',button.dataset.venueId===venue.id));$('detail').innerHTML=`<span class="tag">WEEK ${game.week} · ${esc(game.status.toUpperCase())}</span><h3>${esc(game.title)}</h3><p class="detail-sub">${esc(gameTime(game))}</p><div class="facts">${fact('VENUE',venue.name)}${fact('LOCATION',venue.address)}${fact('SOURCE VENUE ID',venue.id)}${fact('MAP POINT',point?venue.lat.toFixed(5)+', '+venue.lon.toFixed(5):'Not verified')}</div><div class="detail-section"><h4>Schedule & venue provenance</h4><p>ESPN scoreboard ID ${esc(game.id)}. Retrieved ${esc(fmt(game.sourceRetrievedAt))}. Game and venue may change; confirm with the NFL or host club.</p><p>Venue coordinate: ${esc(venue.coordinateStatus)}. ${point?'A name match is not an entrance, footprint, or operational asset.':'No point-specific feed is queried for this venue.'}</p>${link(game.sourceUrl,'ESPN game')}${venue.venueCandidateUrl?' · '+link(venue.venueCandidateUrl,'Wikidata venue candidate'):''}</div><div class="detail-section"><h4>Public conditions</h4><div id="conditions"><p>Loading current public feeds…</p></div></div><div class="detail-section"><h4>Roadway camera sources</h4><div id="cameras"><p>Loading camera metadata…</p></div></div><div class="detail-section"><h4>Road conditions</h4><div id="roads"><p>Loading agency road conditions…</p></div></div>`;renderCameras(game);renderRoads(game);if(point)loadConditions(game);else $('conditions').innerHTML='<p>Point-specific feeds unavailable because the venue map point has not been verified.</p>'}
async function loadConditions(game){
  const venue=game.venue,target=$('conditions'),id=game.id,key=venue.id;
  const nwsUrl='https://api.weather.gov/alerts/active?point='+venue.lat+','+venue.lon;
  let result=cache.get(key);
  if(!result||Date.now()-result.at>300000){
    const usgs='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
    const responses=await Promise.allSettled([json(nwsUrl),json(usgs)]);
    const nws=responses[0].status==='fulfilled'?responses[0].value:null;
    result={at:Date.now(),alerts:Array.isArray(nws?.features)?nws:null,
      alertsError:responses[0].status==='rejected'?String(responses[0].reason):!Array.isArray(nws?.features)?'Invalid NWS alert response':null,
      quakes:responses[1].status==='fulfilled'?responses[1].value:null,
      quakesError:responses[1].status==='rejected'?String(responses[1].reason):null};
    cache.set(key,result);
  }
  if(selected!==id)return;
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
    `<p class="feed-state">USGS EARTHQUAKES · ${result.quakesError?'UNAVAILABLE':'PAST SEVEN DAYS'}</p>`+
    (result.quakesError?`<p>${esc(result.quakesError)}</p>`:quakes.length?quakes.map(item=>`<p>${esc(item.properties?.title)} · ${link(item.properties?.url,'USGS record')}</p>`).join(''):'<p>No magnitude 2.5+ event returned within 250 km. Proximity alone does not establish impact.</p>')+
    '<div id="forecast"><p>Checking the NWS kickoff forecast window…</p></div>';
  loadForecast(game);
}
async function loadForecast(game){const target=$('forecast'),venue=game.venue,kickoff=Date.parse(game.kickoff),hours=(kickoff-Date.now())/3600000;if(game.timeTbd){target.innerHTML='<p class="feed-state">KICKOFF FORECAST · TIME TBD</p><p>Forecast matching starts when a kickoff time is published.</p>';return}if(hours<0||hours>168){target.innerHTML='<p class="feed-state">KICKOFF FORECAST · OUTSIDE WINDOW</p><p>NWS hourly forecasts cover approximately seven days ahead.</p>';return}try{const point=await json('https://api.weather.gov/points/'+venue.lat+','+venue.lon),url=point.properties?.forecastHourly;if(!url||new URL(url).origin!=='https://api.weather.gov')throw Error('NWS hourly link unavailable');const forecast=await json(url),period=forecast.properties?.periods?.find(item=>Date.parse(item.startTime)<=kickoff&&kickoff<Date.parse(item.endTime));if(selected!==game.id)return;target.innerHTML=period?`<p class="feed-state">KICKOFF FORECAST · NWS HOURLY</p><p>${esc(period.shortForecast)} · ${esc(period.temperature)}°${esc(period.temperatureUnit)} · Wind ${esc(period.windSpeed)} ${esc(period.windDirection)} · Precipitation ${period.probabilityOfPrecipitation?.value==null?'not supplied':esc(period.probabilityOfPrecipitation.value)+'%'}</p><p>${link(url,'NWS forecast')} · Forecast may change; check again close to kickoff.</p>`:'<p>NWS supplied no hourly period covering kickoff.</p>'}catch(error){if(selected===game.id)target.innerHTML=`<p class="feed-state">KICKOFF FORECAST · UNAVAILABLE</p><p>${esc(error.message)}</p>`}}
async function init(){loadNtas();try{snapshot=await json('nfl.json');const games=snapshot.games,venues=new Set(games.map(game=>game.venue.id)),next=sorted(games.slice()).find(game=>Date.parse(game.kickoff)>=Date.now());$('game-count').textContent=games.length.toLocaleString();$('venue-count').textContent=venues.size;$('next-kickoff').textContent=next?fmt(next.kickoff):'Season complete';$('source-state').textContent=snapshot.source.status.toUpperCase();$('freshness').textContent='Built '+fmt(snapshot.builtAt);$('week').innerHTML+=Array.from({length:18},(_,index)=>`<option value="${index+1}">Week ${index+1}</option>`).join('');$('search').oninput=renderList;$('week').onchange=renderList;$('time').onchange=renderList;renderList();renderCoverage();if(next)selectGame(next.id);try{cameraSnapshot=await json('cameras.json')}catch{cameraSnapshot=null}renderCoverage();if(selected)renderCameras(games.find(game=>game.id===selected));try{roadSnapshot=await json('roads.json')}catch{roadSnapshot=null}renderCoverage();if(selected)renderRoads(games.find(game=>game.id===selected))}catch(error){$('games').innerHTML=`<p class="empty" style="padding:20px">Schedule unavailable: ${esc(error.message)}</p>`;$('freshness').textContent='Source unavailable'}}
init();
