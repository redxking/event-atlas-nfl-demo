const cueSources=[
  {type:'weather alert',name:'NWS point alerts',states:['checked']},
  {type:'convective outlook',name:'NOAA SPC convective outlook',states:['no point match in current Day 1–3 outlook','published outlook at kickoff']},
  {type:'excessive rainfall outlook',name:'NOAA WPC excessive-rainfall outlook',states:['no point match in current Day 1–3 outlook','published outlook at kickoff']},
  {type:'road condition',name:'Road conditions',states:['time screened']},
  {type:'transit alert',name:'MBTA Foxboro station alerts',states:['station alerts checked'],host:'api-v3.mbta.com'},
  {type:'transit alert',name:'SEPTA B Line service alerts',states:['current snapshot'],host:'www.septa.org'}
];
const rows=picture=>new Map((picture?.sources||[]).map(item=>[item.name,item]));
const cueKey=cue=>cue.sourceId?JSON.stringify([cue.type,cue.sourceId,cue.title,cue.basis]):JSON.stringify([cue.type,cue.title,cue.sourceUrl,cue.sourceAt]);
const cueHost=cue=>{try{return new URL(cue.sourceUrl).hostname}catch{return null}};
const forecastKey=forecast=>JSON.stringify([forecast?.period?.startTime,forecast?.period?.endTime,forecast?.period?.shortForecast,forecast?.period?.temperature,forecast?.period?.temperatureUnit,forecast?.period?.windSpeed,forecast?.period?.windDirection,forecast?.period?.precipitationPercent]);

export function diffEventPicture(before,after,previousNews,currentNews,previousGame,currentGame,observedAt=new Date().toISOString()){
  if(!before||before.eventId!==after?.eventId)return [];
  const changes=[],oldRows=rows(before),newRows=rows(after);
  const eventWindowChanged=previousGame?.kickoff!==currentGame?.kickoff||previousGame?.status!==currentGame?.status||previousGame?.timeTbd!==currentGame?.timeTbd;
  if(eventWindowChanged)changes.push({kind:'schedule_changed',observedAt,title:'Published game time or status changed',detail:'Review the new schedule and repeat event-window screening. The change is not an incident finding.',sourceUrl:currentGame?.sourceUrl||null});
  if(!eventWindowChanged&&previousGame?.gameState&&currentGame?.gameState&&Number.isFinite(Date.parse(previousGame.sourceRetrievedAt))&&Date.parse(currentGame.sourceRetrievedAt)>Date.parse(previousGame.sourceRetrievedAt)&&JSON.stringify(previousGame.gameState)!==JSON.stringify(currentGame.gameState))changes.push({kind:'game_state_changed',observedAt,title:'Publisher game score or period changed',detail:'The publisher scoreboard differs from the prior retrieved snapshot. Confirm the latest game state with the source; this does not establish crowd movement, venue impact, or a threat.',sourceUrl:currentGame.sourceUrl||null});
  for(const [name,next] of newRows){
    const prior=oldRows.get(name);
    if(prior&&prior.state!==next.state)changes.push({kind:'source_status_changed',observedAt,title:`${name}: ${prior.state} → ${next.state}`,detail:'Source coverage or screening status changed; verify the linked publisher before acting.',sourceUrl:next.sourceUrl||prior.sourceUrl||null});
  }
  const oldFire=before.wildfireContext,newFire=after.wildfireContext;
  if(!eventWindowChanged&&oldFire?.state==='current_snapshot'&&newFire?.state==='current_snapshot'&&Number.isFinite(Date.parse(oldFire.asOf))&&Date.parse(newFire.asOf)>Date.parse(oldFire.asOf)&&Array.isArray(oldFire.events)&&Array.isArray(newFire.events)){
    const priorById=new Map(oldFire.events.map(item=>[item.id,item]));
    for(const item of newFire.events.slice(0,5)){
      if(!Number.isInteger(item?.id)||item.sourceUrl!==`https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/${item.id}`||!Number.isFinite(item.distanceKm)||item.distanceKm<0||item.distanceKm>150)continue;
      const prior=priorById.get(item.id),updated=prior&&Date.parse(item.updatedAt)>Date.parse(prior.updatedAt)&&(item.acres!==prior.acres||item.containedPercent!==prior.containedPercent||item.lat!==prior.lat||item.lon!==prior.lon);
      if(!prior||updated)changes.push({kind:prior?'wildfire_point_revised':'new_wildfire_point',observedAt,title:`NIFC wildfire point: ${item.name}`.slice(0,300),detail:`${prior?'Changed source fields for':'Newly displayed in the bounded sample:'} NIFC wildfire point ${item.distanceKm} km from the candidate venue point; source updated ${item.updatedAt}. Confirm the current incident with the responsible fire authority. This point is not a perimeter, smoke measurement, venue impact, or threat finding.`,sourceUrl:item.sourceUrl});
    }
  }
  const oldAir=before.airQualityContext,newAir=after.airQualityContext;
  if(!eventWindowChanged&&oldAir?.state==='current_station_observation'&&newAir?.state==='current_station_observation'&&Number.isFinite(Date.parse(oldAir.asOf))&&Date.parse(newAir.asOf)>Date.parse(oldAir.asOf)){
    const first=oldAir.observation,next=newAir.observation;
    if(first&&next&&first.sourceUrl===oldAir.sourceUrl&&next.sourceUrl===newAir.sourceUrl&&/^https:\/\/ofmpub\.epa\.gov\/rsig\/rsigserver\?/.test(next.sourceUrl||'')&&/^\d{1,8}$/.test(next.stationId||'')&&Number.isFinite(next.pm25UgM3)&&Number.isFinite(first.pm25UgM3)&&Number.isFinite(next.distanceKm)&&next.distanceKm>=0&&next.distanceKm<=50&&Date.parse(next.observedAt)>Date.parse(first.observedAt)){
      if(first.stationId!==next.stationId)changes.push({kind:'pm25_station_changed',observedAt,title:'Nearby EPA PM2.5 station changed',detail:`The nearest current station changed from ${first.stationId} to ${next.stationId}; the new station is ${next.distanceKm} km from the candidate venue point and measured ${next.pm25UgM3} µg/m³ at ${next.observedAt}. Values from different stations are not a venue trend. Verify the source and local conditions.`,sourceUrl:next.sourceUrl});
      else if(Math.abs(next.pm25UgM3-first.pm25UgM3)>=5)changes.push({kind:'pm25_observation_changed',observedAt,title:'Nearby EPA PM2.5 station reading changed',detail:`Station ${next.stationId}, ${next.distanceKm} km from the candidate venue point, changed from ${first.pm25UgM3} to ${next.pm25UgM3} µg/m³ between ${first.observedAt} and ${next.observedAt}. The 5 µg/m³ display threshold is a product review filter, not a health threshold. Confirm with the local air-quality authority; this does not attribute smoke or establish stadium impact.`,sourceUrl:next.sourceUrl});
    }
  }
  const oldSmoke=before.smokeContext,newSmoke=after.smokeContext;
  if(!eventWindowChanged&&oldSmoke?.state==='recent_daily_analysis'&&newSmoke?.state==='recent_daily_analysis'&&Number.isFinite(Date.parse(oldSmoke.asOf))&&Date.parse(newSmoke.asOf)>Date.parse(oldSmoke.asOf)&&Array.isArray(oldSmoke.polygons)&&Array.isArray(newSmoke.polygons)){
    const key=item=>JSON.stringify([item.sourceUrl,item.polygonIndex,item.density,item.startAt,item.endAt]);
    const prior=new Set(oldSmoke.polygons.map(key));
    for(const item of newSmoke.polygons.slice(0,3))if(!prior.has(key(item))&&Number.isInteger(item?.polygonIndex)&&['light','medium','heavy'].includes(item.density)&&item.sourceUrl===newSmoke.sourceUrl&&/^https:\/\/satepsanone\.nesdis\.noaa\.gov\/pub\/FIRE\/web\/HMS\/Smoke_Polygons\/KML\/\d{4}\/\d{2}\/hms_smoke\d{8}\.kml$/.test(item.sourceUrl||''))changes.push({kind:'new_satellite_smoke_match',observedAt,title:`NOAA HMS ${item.density} smoke polygon point match`,detail:`Newly displayed in a dated NOAA satellite analysis at the candidate venue point; polygon window ${item.startAt} to ${item.endAt}. This is not a ground-level concentration, current smoke forecast, source-fire attribution, exposure, venue impact, or threat finding. Verify with NOAA and the local air-quality authority.`,sourceUrl:item.sourceUrl});
  }
  const oldCorrelation=before.environmentalCorrelation,newCorrelation=after.environmentalCorrelation;
  if(!eventWindowChanged&&['no_polygon_point_match','station_observation_after_polygon_windows','different_published_time_windows'].includes(oldCorrelation?.state)&&newCorrelation?.state==='same_published_time_window'&&oldSmoke?.state==='recent_daily_analysis'&&newSmoke?.state==='recent_daily_analysis'&&before.airQualityContext?.state==='current_station_observation'&&after.airQualityContext?.state==='current_station_observation'&&Number.isFinite(Date.parse(newSmoke.asOf))&&Number.isFinite(Date.parse(oldSmoke.asOf))&&Number.isFinite(Date.parse(after.airQualityContext.asOf))&&Number.isFinite(Date.parse(before.airQualityContext.asOf))&&(Date.parse(newSmoke.asOf)>Date.parse(oldSmoke.asOf)||Date.parse(after.airQualityContext.asOf)>Date.parse(before.airQualityContext.asOf))&&/^https:\/\/satepsanone\.nesdis\.noaa\.gov\/pub\/FIRE\/web\/HMS\/Smoke_Polygons\/KML\/\d{4}\/\d{2}\/hms_smoke\d{8}\.kml$/.test(newCorrelation.smokeSourceUrl||''))changes.push({kind:'smoke_pm25_time_overlap',observedAt,title:'NOAA smoke polygon and nearby EPA station time windows overlap',detail:`A newer bounded source sample shows the candidate venue point in a NOAA smoke polygon during a nearby EPA PM2.5 station observation at ${newCorrelation.stationObservedAt}. The station is ${newCorrelation.stationDistanceKm} km from the venue candidate point. This is a time comparison, not source attribution, stadium exposure, a health finding, or a threat. Verify both publisher records and current local conditions.`,sourceUrl:newCorrelation.smokeSourceUrl});
  if(!eventWindowChanged)for(const spec of cueSources){
    if(!spec.states.includes(oldRows.get(spec.name)?.state)||!spec.states.includes(newRows.get(spec.name)?.state))continue;
    const matches=cue=>cue.type===spec.type&&(!spec.host||cueHost(cue)===spec.host);
    const oldKeys=new Set((before.cues||[]).filter(matches).map(cueKey));
    for(const cue of (after.cues||[]).filter(matches))if(!oldKeys.has(cueKey(cue)))changes.push({kind:'newly_displayed_cue',observedAt,title:cue.title,detail:`New in this page's bounded ${spec.type} sample. ${cue.basis} This is not a confirmed venue impact or threat.`,sourceUrl:cue.sourceUrl||null});
  }
  if(!eventWindowChanged&&['current forecast','current event-hour forecast'].includes(before.forecastContext?.state)&&before.forecastContext.state===after.forecastContext?.state&&before.forecastContext.sourceUrl===after.forecastContext.sourceUrl&&forecastKey(before.forecastContext)!==forecastKey(after.forecastContext))changes.push({kind:'forecast_changed',observedAt,title:after.forecastContext.state==='current event-hour forecast'?'NWS event-hour forecast changed':'NWS kickoff forecast changed',detail:'The displayed hourly forecast values differ between two current checks. Verify the linked NWS forecast; this is not an observed hazard or threat.',sourceUrl:after.forecastContext.sourceUrl});
  if(before.gameArticle?.state==='current_snapshot'&&after.gameArticle?.state==='current_snapshot'&&Date.parse(after.gameArticle.asOf)>Date.parse(before.gameArticle.asOf)&&JSON.stringify(before.gameArticle.article)!==JSON.stringify(after.gameArticle.article))changes.push({kind:'game_article_changed',observedAt,title:'ESPN game-linked article changed',detail:'The publisher headline or article revision differs from the prior checked snapshot. Open the linked article to verify the update; it does not establish attendance, venue impact, or a threat.',sourceUrl:after.gameArticle.article.url});
  if(before.directGame?.state==='checked'&&after.directGame?.state==='checked'&&Date.parse(after.directGame.checkedAt)>Date.parse(before.directGame.checkedAt)){
    const first=before.directGame,next=after.directGame;
    if(first.sourceStatus!==next.sourceStatus||JSON.stringify(first.gameState)!==JSON.stringify(next.gameState)||first.reportedAttendance!==next.reportedAttendance)changes.push({kind:'direct_game_state_changed',observedAt,title:'Selected-game publisher status or score changed',detail:'The newer direct ESPN game summary differs in status, score or reported attendance. Verify the source; this is not evidence of crowd movement, venue impact, or a threat.',sourceUrl:next.sourceUrl});
    if(JSON.stringify(first.article)!==JSON.stringify(next.article))changes.push({kind:'direct_game_article_changed',observedAt,title:'Selected-game publisher article changed',detail:'The newer game-linked ESPN headline or revision differs from the prior direct check. Open the article to verify claims; attendance and threat relevance remain unverified.',sourceUrl:next.article?.url||next.sourceUrl});
    if(!first.scheduleDiffers&&next.scheduleDiffers)changes.push({kind:'direct_schedule_discrepancy',observedAt,title:'Direct ESPN game date differs from published schedule',detail:'Confirm the event time with the NFL or host club and repeat event-window screening; this is not an incident finding.',sourceUrl:next.sourceUrl});
  }
  if(previousNews?.state==='current_snapshot'&&currentNews?.state==='current_snapshot'){
    const titleMatch=item=>['both_teams_in_title','matchup_phrase_in_title'].includes(item?.matchBasis);
    const oldUrls=new Set(previousNews.articles.filter(titleMatch).map(item=>item.url));
    for(const item of currentNews.articles.filter(titleMatch))if(!oldUrls.has(item.url))changes.push({kind:'newly_displayed_headline',observedAt,title:item.title,detail:`${item.publisher} headline names both teams, published ${item.publishedAt}. Verify that the article concerns this specific game; a title match does not establish attendance, venue impact, or a threat.`,sourceUrl:item.url});
  }
  const oldCity=before.citywideAlertsContext,newCity=after.citywideAlertsContext;
  if(oldCity?.state==='retrieved'&&newCity?.state==='retrieved'&&Array.isArray(oldCity.alerts)&&Array.isArray(newCity.alerts)&&oldCity.alerts.length<=20&&newCity.alerts.length<=20){
    const oldNotices=new Map(oldCity.alerts.map(item=>[JSON.stringify([item.title,item.url]),item]));
    for(const item of newCity.alerts.slice(0,4)){
      const previous=oldNotices.get(JSON.stringify([item.title,item.url]));
      if(!previous||previous.detail!==item.detail)changes.push({kind:previous?'city_notice_changed':'new_city_notice',observedAt,title:`Philadelphia city notice: ${item.title}`,detail:'A city website-wide notice was added or its displayed text changed between two checked snapshots. Verify its current content and event relevance; this is not a stadium incident, impact, or threat finding.',sourceUrl:item.url||newCity.sourceUrl||null});
    }
  }
  const oldGreenBay=before.greenBayAlertContext,newGreenBay=after.greenBayAlertContext;
  if(!eventWindowChanged&&oldGreenBay?.state==='current_snapshot'&&newGreenBay?.state==='current_snapshot'&&Number.isFinite(Date.parse(oldGreenBay.asOf))&&Date.parse(newGreenBay.asOf)>Date.parse(oldGreenBay.asOf)&&Array.isArray(oldGreenBay.alerts)&&Array.isArray(newGreenBay.alerts)&&oldGreenBay.alerts.length<=20&&newGreenBay.alerts.length<=20){
    const prior=new Map(oldGreenBay.alerts.map(item=>[item.url,item]));
    for(const item of newGreenBay.alerts){
      if(!/^https:\/\/www\.greenbaywi\.gov\/AlertCenter\.aspx(?:\?|$)/.test(item?.url||'')||!['emergency','police'].includes(item.kind))continue;
      const old=prior.get(item.url);
      if(!old||old.title!==item.title||old.detail!==item.detail)changes.push({kind:old?'city_notice_changed':'new_city_notice',observedAt,title:`Green Bay ${item.kind} website notice: ${item.title}`.slice(0,300),detail:`${old?'Displayed text changed':'Newly displayed in the checked active city RSS category'}; publisher date ${item.publishedAt||'not supplied'}. Verify the current city notice and its event relevance. The feed has no incident geometry; this is not a stadium incident, impact, or threat finding.`,sourceUrl:item.url});
    }
  }
  const oldPlan=before.lambeauPlanContext,newPlan=after.lambeauPlanContext;
  if(!eventWindowChanged&&oldPlan?.state==='current_published_plan'&&newPlan?.state==='current_published_plan'&&Number.isFinite(Date.parse(oldPlan.asOf))&&Date.parse(newPlan.asOf)>Date.parse(oldPlan.asOf)&&oldPlan.sourceUrl===newPlan.sourceUrl&&newPlan.sourceUrl==='https://www.packers.com/lambeau-field/gameday-information'&&Array.isArray(oldPlan.claims)&&Array.isArray(newPlan.claims)&&oldPlan.claims.length===6&&newPlan.claims.length===6){
    const first=new Map(oldPlan.claims.map(item=>[item.id,item.sourceTextSha256]));
    const changed=newPlan.claims.filter(item=>first.has(item.id)&&first.get(item.id)!==item.sourceTextSha256).map(item=>item.topic);
    if(changed.length)changes.push({kind:'venue_plan_revised',observedAt,title:'Packers game-day operating plan text changed',detail:`The venue page text underlying ${changed.join(', ')} changed between two checks. Review the current page and confirm the applicable game-day plan with the venue and responsible agencies. A publisher text change is not a live closure, bus run, venue impact, or threat finding.`,sourceUrl:newPlan.sourceUrl});
  }
  const oldRelease=before.packersReleaseContext,newRelease=after.packersReleaseContext;
  if(!eventWindowChanged&&['current_published_announcements','partial_published_announcements'].includes(oldRelease?.state)&&['current_published_announcements','partial_published_announcements'].includes(newRelease?.state)&&Number.isFinite(Date.parse(oldRelease.asOf))&&Date.parse(newRelease.asOf)>Date.parse(oldRelease.asOf)&&Array.isArray(oldRelease.claims)&&Array.isArray(newRelease.claims)&&oldRelease.claims.length<=9&&newRelease.claims.length<=9){
    const prior=new Map(oldRelease.claims.map(item=>[item.id,item.sourceTextSha256]));
    for(const item of newRelease.claims){
      if(!/^https:\/\/www\.packers\.com\/news\//.test(item?.sourceUrl||'')||!/^\w{3,30}$/.test(item?.id||'')||!/^\w{3,30}$/.test(item?.category||'')||!/^[a-f0-9]{64}$/.test(item?.sourceTextSha256||''))continue;
      const priorHash=prior.get(item.id);
      if(priorHash!==item.sourceTextSha256)changes.push({kind:priorHash?'club_announcement_revised':'club_announcement_added',observedAt,title:`Packers ${item.category.replaceAll('_',' ')}: ${item.id.replaceAll('_',' ')}`,detail:`The official game article ${priorHash?'changed text underlying':'added'} this bounded announcement between two checks. Verify the club article before use. It remains a published plan, not confirmed person attendance, aircraft activity, venue impact, or a threat finding.`,sourceUrl:item.sourceUrl});
    }
  }
  for(const spec of [
    {key:'patriotsPreviewContext',eventId:'nfl:401872986',url:'https://www.patriots.com/news/game-preview-patriots-vs-raiders-nfl-week-5',states:['current_published_announcements','partial_published_announcements'],max:3,label:'Patriots'},
    {key:'jetsGuideContext',eventId:'nfl:401872983',url:'https://www.newyorkjets.com/fans/gameday-guide-2026',states:['current_published_plan','partial_published_plan'],max:5,label:'Jets'},
    {key:'seahawksGuideContext',eventId:'nfl:401872992',url:'https://www.seahawks.com/game-day/',states:['current_published_plan','partial_published_plan'],max:7,label:'Seahawks'},
    {key:'titansGuideContext',eventId:'nfl:401872984',url:'https://www.tennesseetitans.com/stadium/gameday/',states:['current_published_plan','partial_published_plan'],max:6,label:'Titans'},
    {key:'commandersGuideContext',eventId:'nfl:401872988',url:'https://www.commanders.com/matchups/giants',states:['current_published_plan','partial_published_plan'],max:9,label:'Commanders'},
    {key:'falconsGuideContext',eventId:'nfl:401872993',url:'https://www.atlantafalcons.com/tickets/gameday',states:['current_published_plan','partial_published_plan'],max:9,label:'Falcons'},
    {key:'dolphinsCrucialCatchContext',eventId:'nfl:401872982',url:'https://www.miamidolphins.com/news/dolphins-cancer-challenge-celebrates-100-million-lifetime-raised-at-crucial-catch-game',states:['current_published_plan','partial_published_plan'],max:6,label:'Dolphins'},
    {key:'saintsGuideContext',eventId:'nfl:401872987',url:'https://www.neworleanssaints.com/news/saints-vs-vikings-2026-nfl-week-5-gameday-guide',states:['current_published_plan','partial_published_plan'],max:5,label:'Saints'},
    {key:'martaRailContext',eventId:'nfl:401872993',url:'https://itsmarta.com/special-rail-schedules.aspx',states:['current_published_schedule','partial_published_schedule'],max:4,label:'MARTA'}
  ]){
    const prior=before[spec.key],next=after[spec.key];
    if(eventWindowChanged||after.eventId!==spec.eventId||!spec.states.includes(prior?.state)||!spec.states.includes(next?.state)||prior.sourceUrl!==spec.url||next.sourceUrl!==spec.url||!Number.isFinite(Date.parse(prior.asOf))||Date.parse(next.asOf)<=Date.parse(prior.asOf)||!Array.isArray(prior.claims)||!Array.isArray(next.claims)||prior.claims.length>spec.max||next.claims.length>spec.max)continue;
    const valid=item=>item?.sourceUrl===spec.url&&/^\w{3,30}$/.test(item.id||'')&&/^\w{3,30}$/.test(item.category||'')&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'');
    if(!prior.claims.every(valid)||!next.claims.every(valid))continue;
    const oldById=new Map(prior.claims.map(item=>[item.id,item]));
    const newById=new Map(next.claims.map(item=>[item.id,item]));
    for(const item of next.claims){
      const old=oldById.get(item.id);
      if(!old||old.sourceTextSha256!==item.sourceTextSha256)changes.push({kind:spec.label==='MARTA'?(old?'operator_schedule_revised':'operator_schedule_matched'):(old?'club_passage_revised':'club_passage_matched'),observedAt,title:`${spec.label} ${item.category.replaceAll('_',' ')}: ${item.id.replaceAll('_',' ')}`,detail:`The ${spec.label} page ${old?'changed the text underlying':'now matches'} this bounded claim between checks. Review the publisher page. This is a published plan or recommendation, not verified attendance, actual operations, impact, or a threat.`,sourceUrl:spec.url});
    }
    for(const item of prior.claims)if(!newById.has(item.id))changes.push({kind:spec.label==='MARTA'?'operator_schedule_unmatched':'club_passage_unmatched',observedAt,title:`${spec.label} passage no longer matches: ${item.id.replaceAll('_',' ')}`,detail:`The bounded extractor no longer matches this ${spec.label} page passage. It may have changed or disappeared; this does not prove the plan was cancelled or an activity ended. Review the current publisher page.`,sourceUrl:spec.url});
  }
  const oldCityEvent=before.nolaReadyEventContext,newCityEvent=after.nolaReadyEventContext;
  const cityUrl='https://ready.nola.gov/incident/crescent-city-blues-bbq-festival-2026/crescent-city-blues-bbq-festival-2026/';
  const validCityClaim=item=>['sunday_window','cbd_location','traffic_advisory','camp_closure'].includes(item?.id)&&item.sourceUrl===cityUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'');
  if(!eventWindowChanged&&after.eventId==='nfl:401872987'&&['current_city_notice','partial_city_notice'].includes(oldCityEvent?.state)&&['current_city_notice','partial_city_notice'].includes(newCityEvent?.state)&&oldCityEvent.sourceUrl===cityUrl&&newCityEvent.sourceUrl===cityUrl&&Number.isFinite(Date.parse(oldCityEvent.asOf))&&Date.parse(newCityEvent.asOf)>Date.parse(oldCityEvent.asOf)&&Array.isArray(oldCityEvent.claims)&&Array.isArray(newCityEvent.claims)&&oldCityEvent.claims.length<=4&&newCityEvent.claims.length<=4&&oldCityEvent.claims.every(validCityClaim)&&newCityEvent.claims.every(validCityClaim)){
    const oldClaims=new Map(oldCityEvent.claims.map(item=>[item.id,item]));
    const newClaims=new Map(newCityEvent.claims.map(item=>[item.id,item]));
    for(const item of newCityEvent.claims){
      const prior=oldClaims.get(item.id);
      if(!prior||prior.sourceTextSha256!==item.sourceTextSha256)changes.push({kind:prior?'city_event_notice_revised':'city_event_notice_matched',observedAt,title:`NOLA Ready festival ${item.id.replaceAll('_',' ')}`,detail:'The official city page changed or added a bounded event passage between checks. Verify current festival and street plans with the city; this does not prove a stadium route impact, incident, or threat.',sourceUrl:cityUrl});
    }
    for(const item of oldCityEvent.claims)if(!newClaims.has(item.id))changes.push({kind:'city_event_notice_unmatched',observedAt,title:`NOLA Ready festival passage no longer matches: ${item.id.replaceAll('_',' ')}`,detail:'The bounded extractor no longer matches this city passage. Verify the city page; this does not establish that an event or closure ended.',sourceUrl:cityUrl});
  }
  const oldRegional=before.nolaReadyRegionalContext,newRegional=after.nolaReadyRegionalContext;
  const regionalUrl='https://ready.nola.gov/incident/the-city-of-new-orleans-has-granted-permits-to-fes/national-fried-chicken-festival-2026/';
  const validRegional=item=>['sunday_window','lakefront_location','traffic_advisory'].includes(item?.id)&&item.sourceUrl===regionalUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'');
  if(!eventWindowChanged&&after.eventId==='nfl:401872987'&&['current_regional_notice','partial_regional_notice'].includes(oldRegional?.state)&&['current_regional_notice','partial_regional_notice'].includes(newRegional?.state)&&oldRegional.sourceUrl===regionalUrl&&newRegional.sourceUrl===regionalUrl&&Number.isFinite(Date.parse(oldRegional.asOf))&&Date.parse(newRegional.asOf)>Date.parse(oldRegional.asOf)&&Array.isArray(oldRegional.claims)&&Array.isArray(newRegional.claims)&&oldRegional.claims.length<=3&&newRegional.claims.length<=3&&oldRegional.claims.every(validRegional)&&newRegional.claims.every(validRegional)){
    const prior=new Map(oldRegional.claims.map(item=>[item.id,item]));
    const next=new Map(newRegional.claims.map(item=>[item.id,item]));
    for(const item of newRegional.claims){
      const old=prior.get(item.id);
      if(!old||old.sourceTextSha256!==item.sourceTextSha256)changes.push({kind:old?'city_regional_notice_revised':'city_regional_notice_matched',observedAt,title:`NOLA Ready Lakefront festival ${item.id.replaceAll('_',' ')}`,detail:'The official city page changed or added a bounded regional event passage. Verify current hours and location with the city; this does not establish a Superdome travel or security effect.',sourceUrl:regionalUrl});
    }
    for(const item of oldRegional.claims)if(!next.has(item.id))changes.push({kind:'city_regional_notice_unmatched',observedAt,title:`NOLA Ready Lakefront passage no longer matches: ${item.id.replaceAll('_',' ')}`,detail:'The bounded extractor no longer matches this city passage. Verify the city page; this does not establish that the festival or its traffic plan ended.',sourceUrl:regionalUrl});
  }
  const oldActive=before.nolaReadyActiveContext,newActive=after.nolaReadyActiveContext;
  const activeUrl='https://ready.nola.gov/incident/';
  const validActive=item=>/^[a-z0-9_-]{3,120}$/.test(item?.id||'')&&typeof item.title==='string'&&item.title.length>=3&&item.title.length<=180&&item.url===`${activeUrl}${item.id}/`;
  if(!eventWindowChanged&&currentGame?.venue?.id==='3493'&&oldActive?.state==='current_index'&&newActive?.state==='current_index'&&oldActive.sourceUrl===activeUrl&&newActive.sourceUrl===activeUrl&&Number.isFinite(Date.parse(oldActive.asOf))&&Date.parse(newActive.asOf)>Date.parse(oldActive.asOf)&&Array.isArray(oldActive.entries)&&Array.isArray(newActive.entries)&&oldActive.entries.length<=20&&newActive.entries.length<=20&&oldActive.entries.every(validActive)&&newActive.entries.every(validActive)){
    const prior=new Map(oldActive.entries.map(item=>[item.id,item]));
    const next=new Map(newActive.entries.map(item=>[item.id,item]));
    for(const item of newActive.entries){
      const old=prior.get(item.id);
      if(!old||old.title!==item.title)changes.push({kind:old?'city_index_title_changed':'city_index_item_added',observedAt,title:`NOLA Ready index: ${item.title}`,detail:'The city active-incident index lists this item in the newer check. Open its page to verify dates, location, current status, and event relevance. The listing is not proof of a stadium incident or threat.',sourceUrl:item.url});
    }
    for(const item of oldActive.entries)if(!next.has(item.id))changes.push({kind:'city_index_item_unlisted',observedAt,title:`NOLA Ready index no longer lists: ${item.title}`,detail:'The newer city index no longer lists this item. This does not prove the event or incident ended; verify its page and the issuing authority.',sourceUrl:item.url});
  }
  const oldUpdates=before.nolaReadyUpdatesContext,newUpdates=after.nolaReadyUpdatesContext;
  const oldOem=before.nashvilleOemNewsContext,newOem=after.nashvilleOemNewsContext;
  const validOem=item=>typeof item?.title==='string'&&item.title.length>=3&&item.title.length<=180&&Number.isFinite(Date.parse(item.publishedAt))&&/^https:\/\/www\.nashville\.gov\/departments\/emergency-management\/news\/[a-z0-9-]+$/.test(item.url||'');
  if(!eventWindowChanged&&currentGame?.venue?.id==='3810'&&oldOem?.state==='current_newsroom_check'&&newOem?.state==='current_newsroom_check'&&oldOem.sourceUrl==='https://www.nashville.gov/departments/emergency-management/news'&&newOem.sourceUrl===oldOem.sourceUrl&&Number.isFinite(Date.parse(oldOem.asOf))&&Date.parse(newOem.asOf)>Date.parse(oldOem.asOf)&&Array.isArray(oldOem.recent)&&Array.isArray(newOem.recent)&&oldOem.recent.length<=20&&newOem.recent.length<=20&&oldOem.recent.every(validOem)&&newOem.recent.every(validOem)){
    const prior=new Map(oldOem.recent.map(item=>[item.url,item]));
    for(const item of newOem.recent){
      const old=prior.get(item.url);
      if(!old)changes.push({kind:'city_release_published',observedAt,title:`Nashville OEM release: ${item.title}`,detail:`OEM newsroom lists this release as published ${item.publishedAt}. Verify the page, current condition, location, and Titans-event relevance; a release is not a live alert or threat finding.`,sourceUrl:item.url});
      else if(old.title!==item.title||old.publishedAt!==item.publishedAt)changes.push({kind:'city_release_revised',observedAt,title:`Nashville OEM release revised: ${item.title}`,detail:'The newsroom title or publication time changed. Verify the publisher page and current scope before operational use.',sourceUrl:item.url});
    }
  }
  const updatesUrl='https://ready.nola.gov/incident/?rss=NOLA-Ready-Updates';
  const validUpdate=item=>typeof item?.title==='string'&&item.title.length>=3&&item.title.length<=180&&Number.isFinite(Date.parse(item.publishedAt))&&/^https:\/\/ready\.nola\.gov\/incident\/[^/?#]+\/[^/?#]+\/$/.test(item.url||'');
  if(!eventWindowChanged&&currentGame?.venue?.id==='3493'&&oldUpdates?.state==='current_updates'&&newUpdates?.state==='current_updates'&&oldUpdates.sourceUrl===updatesUrl&&newUpdates.sourceUrl===updatesUrl&&Number.isFinite(Date.parse(oldUpdates.asOf))&&Date.parse(newUpdates.asOf)>Date.parse(oldUpdates.asOf)&&Array.isArray(oldUpdates.entries)&&Array.isArray(newUpdates.entries)&&oldUpdates.entries.length<=20&&newUpdates.entries.length<=20&&oldUpdates.entries.every(validUpdate)&&newUpdates.entries.every(validUpdate)){
    const prior=new Map(oldUpdates.entries.map(item=>[item.url,item]));
    for(const item of newUpdates.entries){
      const old=prior.get(item.url);
      if(!old)changes.push({kind:'city_update_published',observedAt,title:`NOLA Ready update: ${item.title}`,detail:`City RSS lists this update as published ${item.publishedAt}. Read its page to verify what changed, its location and event relevance; a headline is not a stadium incident or threat finding.`,sourceUrl:item.url});
      else if(old.title!==item.title||old.publishedAt!==item.publishedAt)changes.push({kind:'city_update_revised',observedAt,title:`NOLA Ready update revised: ${item.title}`,detail:'City RSS title or publication time changed. Verify the publisher page and current scope; this does not establish an incident or threat.',sourceUrl:item.url});
    }
  }
  const priorGeorgia=before.georgiaTrafficContext,nextGeorgia=after.georgiaTrafficContext;
  if(!eventWindowChanged&&after.eventId==='nfl:401872993'&&priorGeorgia?.state==='current_retrieval_time_basis_unverified'&&nextGeorgia?.state==='current_retrieval_time_basis_unverified'&&priorGeorgia.sourcePageUrl==='https://incidentreport.dot.ga.gov/'&&nextGeorgia.sourcePageUrl===priorGeorgia.sourcePageUrl&&Number.isFinite(Date.parse(priorGeorgia.asOf))&&Date.parse(nextGeorgia.asOf)>Date.parse(priorGeorgia.asOf)&&Array.isArray(priorGeorgia.records)&&Array.isArray(nextGeorgia.records)&&priorGeorgia.records.length<=10&&nextGeorgia.records.length<=10){
    const oldById=new Map(priorGeorgia.records.map(item=>[item.id,item]));
    for(const item of nextGeorgia.records){
      if(!/^gdot-\d+$/.test(item?.id||'')||item.sourceUrl!==priorGeorgia.sourcePageUrl)continue;
      const old=oldById.get(item.id);
      if(!old||JSON.stringify([old.detail,old.publisherStatus,old.publisherDisplayedUpdated])!==JSON.stringify([item.detail,item.publisherStatus,item.publisherDisplayedUpdated]))changes.push({kind:'county_road_table_changed',observedAt,title:`Georgia DOT Fulton table row ${item.id} ${old?'changed':'appeared'}`,detail:'A Fulton County row appeared or changed in Georgia DOT’s public table between two retrievals. The table uses publisher-displayed wall times with unverified zone and no venue geometry; verify the record and route before assessing event relevance.',sourceUrl:item.sourceUrl});
    }
  }
  const priorRta=before.nortaAlertContext,nextRta=after.nortaAlertContext;
  if(!eventWindowChanged&&after.venueId==='3493'&&priorRta?.state==='current_page_preview'&&nextRta?.state==='current_page_preview'&&priorRta.sourceUrl==='https://www.norta.com/ride-with-us/service-alerts'&&nextRta.sourceUrl===priorRta.sourceUrl&&Number.isFinite(Date.parse(priorRta.asOf))&&Date.parse(nextRta.asOf)>Date.parse(priorRta.asOf)&&Array.isArray(priorRta.venueTextCandidates)&&Array.isArray(nextRta.venueTextCandidates)&&priorRta.venueTextCandidates.length<=12&&nextRta.venueTextCandidates.length<=12){
    const oldByKey=new Map(priorRta.venueTextCandidates.map(item=>[`${item.routeId}:${item.title}`,item]));
    for(const item of nextRta.venueTextCandidates){
      if(!/^[A-Za-z0-9-]{1,8}$/.test(item?.routeId||'')||!/^[a-f0-9]{64}$/.test(item?.sourceTextSha256||'')||item.sourceUrl!==priorRta.sourceUrl)continue;
      const old=oldByKey.get(`${item.routeId}:${item.title}`);
      if(!old||old.sourceTextSha256!==item.sourceTextSha256)changes.push({kind:old?'transit_notice_revised':'transit_notice_matched',observedAt,title:`RTA ${item.routeId} ${item.title}`.slice(0,300),detail:'A public RTA notice naming a Superdome-area place appeared or changed between page checks. Publisher AS OF time zone and notice end time are unverified. Confirm route geometry, current status and event relevance with RTA before use.',sourceUrl:item.sourceUrl});
    }
  }
  const priorMarta=before.martaAlertContext,nextMarta=after.martaAlertContext;
  if(!eventWindowChanged&&after.eventId==='nfl:401872993'&&priorMarta?.state==='current_preview'&&nextMarta?.state==='current_preview'&&priorMarta.alertPageUrl==='https://itsmarta.com/ride/alerts'&&nextMarta.alertPageUrl===priorMarta.alertPageUrl&&Number.isFinite(Date.parse(priorMarta.asOf))&&Date.parse(nextMarta.asOf)>Date.parse(priorMarta.asOf)&&Array.isArray(priorMarta.alerts)&&Array.isArray(nextMarta.alerts)&&priorMarta.alerts.length<=5&&nextMarta.alerts.length<=5){
    const oldById=new Map(priorMarta.alerts.map(item=>[item.id,item]));
    for(const item of nextMarta.alerts){
      if(!/^[a-f0-9]{16}$/.test(item?.id||'')||!/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'')||item.sourceUrl!==priorMarta.alertPageUrl)continue;
      const old=oldById.get(item.id);
      if(!old||old.sourceTextSha256!==item.sourceTextSha256)changes.push({kind:'operator_alert_preview_changed',observedAt,title:'MARTA Train Alerts preview changed',detail:'An operator homepage notice appeared or its bounded text changed between checks. Verify its current status, time, route and event relevance with MARTA. The preview is incomplete and does not establish stadium impact or a threat.',sourceUrl:item.sourceUrl});
    }
  }
  const priorSounder=before.soundTransitContext,nextSounder=after.soundTransitContext;
  if(!eventWindowChanged&&after.eventId==='nfl:401872992'&&priorSounder?.state==='current_published_service_plan'&&nextSounder?.state==='current_published_service_plan'&&priorSounder.sourceUrl==='https://www.soundtransit.org/get-to-know-us/news-events/calendar/seahawks-vs-san-francisco-2026-10-11'&&nextSounder.sourceUrl===priorSounder.sourceUrl&&Number.isFinite(Date.parse(priorSounder.asOf))&&Date.parse(nextSounder.asOf)>Date.parse(priorSounder.asOf)&&/^[a-f0-9]{64}$/.test(priorSounder.sourceTextSha256||'')&&/^[a-f0-9]{64}$/.test(nextSounder.sourceTextSha256||'')&&priorSounder.sourceTextSha256!==nextSounder.sourceTextSha256)changes.push({kind:'operator_timetable_revised',observedAt,title:'Sound Transit Seahawks event timetable text changed',detail:'The operator page timetable or return-service text differs between two source checks. Confirm the current published plan and actual service with Sound Transit; a text change does not prove cancellation, a train run, crowd impact, or a threat.',sourceUrl:nextSounder.sourceUrl});
  const priorSounderAlerts=before.sounderAlertsContext,nextSounderAlerts=after.sounderAlertsContext;
  if(!eventWindowChanged&&after.eventId==='nfl:401872992'&&['current_snapshot','partial'].includes(priorSounderAlerts?.state)&&['current_snapshot','partial'].includes(nextSounderAlerts?.state)&&Number.isFinite(Date.parse(priorSounderAlerts.sourceAt))&&Date.parse(nextSounderAlerts.sourceAt)>Date.parse(priorSounderAlerts.sourceAt)&&Array.isArray(priorSounderAlerts.alerts)&&Array.isArray(nextSounderAlerts.alerts)){
    const oldById=new Map(priorSounderAlerts.alerts.map(item=>[item.id,item]));
    for(const item of nextSounderAlerts.alerts.slice(0,12)){
      if(!/^[A-Za-z0-9_-]{1,80}$/.test(item?.id||'')||!/^https:\/\/www\.soundtransit\.org\//.test(item?.sourceUrl||''))continue;
      const old=oldById.get(item.id);
      if(!old||JSON.stringify([old.header,old.effect,old.activePeriods])!==JSON.stringify([item.header,item.effect,item.activePeriods]))changes.push({kind:old?'operator_notice_revised':'operator_notice_added',observedAt,title:`Sound Transit Sounder notice ${old?'revised':'added'}: ${item.id}`,detail:`The operator's route-selected ${item.effect||'service'} notice ${old?'changed':'appeared'} between feed checks. Confirm its current text, time and station scope with Sound Transit. An added or revised notice does not establish a train run, stadium impact, or security threat.`,sourceUrl:item.sourceUrl});
    }
  }
  const oldRail=before.njTransitRailContext,newRail=after.njTransitRailContext;
  if(['event-specific advisory listed','regional rail advisory listed'].includes(oldRail?.state)&&['event-specific advisory listed','regional rail advisory listed'].includes(newRail?.state)&&oldRail.gameDate===newRail.gameDate&&Array.isArray(oldRail.advisories)&&Array.isArray(newRail.advisories)){
    const oldUrls=new Set(oldRail.advisories.map(item=>item.url));
    for(const item of newRail.advisories.slice(0,4))if(!oldUrls.has(item.url))changes.push({kind:'new_event_rail_advisory',observedAt,title:item.title,detail:'NJ TRANSIT added an advisory naming this MetLife game. Verify the publisher details; the listing does not establish disruption, train operation, venue impact, or a threat.',sourceUrl:item.url});
    const oldRegional=new Set((oldRail.regionalAdvisories||[]).map(item=>item.url));
    for(const item of (newRail.regionalAdvisories||[]).slice(0,4))if(!oldRegional.has(item.url))changes.push({kind:'new_regional_rail_advisory',observedAt,title:item.title.slice(0,280),detail:'NJ TRANSIT added a region-wide schedule notice for the game date. Verify any effect on a specific trip; the listing does not establish stadium access impact or a threat.',sourceUrl:item.url});
  }
  const oldNj=before.nj511Context,newNj=after.nj511Context;
  if(!eventWindowChanged&&oldNj?.state==='exact game listed'&&newNj?.state==='exact game listed'&&oldNj.gameDate===newNj.gameDate){
    const oldRoads=new Set((oldNj.gameDateRoads||[]).map(item=>JSON.stringify([item.title,item.description,item.publishedAt])));
    for(const item of (newNj.gameDateRoads||[]).slice(0,8))if(!oldRoads.has(JSON.stringify([item.title,item.description,item.publishedAt])))changes.push({kind:'new_511nj_road_entry',observedAt,title:item.title.slice(0,200),detail:`511NJ now lists this road entry within 8 km mentioning the game date: ${item.description.slice(0,500)}. Verify its actual time and route effect; a date mention and proximity do not establish game impact or a threat.`,sourceUrl:newNj.sourceUrl});
  }
  const oldNatural=before.naturalEventsContext,newNatural=after.naturalEventsContext;
  if(!eventWindowChanged&&oldNatural?.state==='current_snapshot'&&newNatural?.state==='current_snapshot'&&Array.isArray(oldNatural.events)&&Array.isArray(newNatural.events)){
    const oldPoints=new Map(oldNatural.events.map(item=>[item.id,item]));
    for(const item of newNatural.events.slice(0,5)){
      const prior=oldPoints.get(item.id);
      if(!prior||Date.parse(item.sourceAt)>Date.parse(prior.sourceAt))changes.push({kind:prior?'natural_event_point_updated':'new_natural_event_point',observedAt,title:`NASA EONET: ${item.title}`.slice(0,300),detail:`NASA EONET ${prior?'updated':'listed'} a natural-event point ${item.distanceKm} km from the candidate venue point, dated ${item.sourceAt}. Verify the NASA record and local authority; proximity does not establish current conditions, venue impact, or a threat.`,sourceUrl:item.sourceUrl});
    }
  }
  const oldUsgs=before.usgsContext,newUsgs=after.usgsContext;
  if(!eventWindowChanged&&oldUsgs?.state==='current_snapshot'&&newUsgs?.state==='current_snapshot'&&Number.isFinite(Date.parse(oldUsgs.asOf))&&Date.parse(newUsgs.asOf)>Date.parse(oldUsgs.asOf)&&Array.isArray(oldUsgs.events)&&Array.isArray(newUsgs.events)){
    const priorById=new Map(oldUsgs.events.map(item=>[item.sourceId,item]));
    for(const item of newUsgs.events.slice(0,3)){
      if(!item?.sourceId||!/^https:\/\/earthquake\.usgs\.gov\/earthquakes\/eventpage\/[A-Za-z0-9_-]+$/.test(item.sourceUrl||''))continue;
      const prior=priorById.get(item.sourceId),changed=prior&&(prior.magnitude!==item.magnitude||prior.updatedAt!==item.updatedAt);
      if(!prior||changed)changes.push({kind:prior?'usgs_earthquake_revised':'new_usgs_earthquake',observedAt,title:`USGS: ${item.title}`.slice(0,300),detail:`${prior?'Revised':'Newly displayed'} in the bounded magnitude 2.5+ weekly USGS sample: magnitude ${item.magnitude??'unavailable'}; ${item.distanceKm} km from the candidate venue point; occurred ${item.occurredAt}. Verify the current USGS record and local effects; proximity does not establish stadium impact or a threat.`,sourceUrl:item.sourceUrl});
    }
  }
  return changes.slice(0,12);
}
