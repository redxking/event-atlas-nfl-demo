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
    if(JSON.stringify(first.article)!==JSON.stringify(next.article))changes.push({kind:'direct_game_article_changed',observedAt,title:'Selected-game publisher article changed',detail:'The newer game-linked ESPN headline or revision differs from the prior browser check. Open the article to verify claims; attendance and threat relevance remain unverified.',sourceUrl:next.article?.url||next.sourceUrl});
    if(!first.scheduleDiffers&&next.scheduleDiffers)changes.push({kind:'direct_schedule_discrepancy',observedAt,title:'Direct ESPN game date differs from published schedule',detail:'Confirm the event time with the NFL or host club and repeat event-window screening; this is not an incident finding.',sourceUrl:next.sourceUrl});
  }
  if(previousNews?.state==='current_snapshot'&&currentNews?.state==='current_snapshot'){
    const oldUrls=new Set(previousNews.articles.map(item=>item.url));
    for(const item of currentNews.articles)if(!oldUrls.has(item.url))changes.push({kind:'newly_displayed_headline',observedAt,title:item.title,detail:`${item.publisher} RSS team mention, published ${item.publishedAt}. Verify that the article concerns this game; it does not establish attendance or a threat.`,sourceUrl:item.url});
  }
  const oldCity=before.citywideAlertsContext,newCity=after.citywideAlertsContext;
  if(oldCity?.state==='retrieved'&&newCity?.state==='retrieved'&&Array.isArray(oldCity.alerts)&&Array.isArray(newCity.alerts)&&oldCity.alerts.length<=20&&newCity.alerts.length<=20){
    const oldNotices=new Map(oldCity.alerts.map(item=>[JSON.stringify([item.title,item.url]),item]));
    for(const item of newCity.alerts.slice(0,4)){
      const previous=oldNotices.get(JSON.stringify([item.title,item.url]));
      if(!previous||previous.detail!==item.detail)changes.push({kind:previous?'city_notice_changed':'new_city_notice',observedAt,title:`Philadelphia city notice: ${item.title}`,detail:'A city website-wide notice was added or its displayed text changed between two checked snapshots. Verify its current content and event relevance; this is not a stadium incident, impact, or threat finding.',sourceUrl:item.url||newCity.sourceUrl||null});
    }
  }
  const oldRail=before.njTransitRailContext,newRail=after.njTransitRailContext;
  if(oldRail?.state==='event-specific advisory listed'&&newRail?.state==='event-specific advisory listed'&&oldRail.gameDate===newRail.gameDate&&Array.isArray(oldRail.advisories)&&Array.isArray(newRail.advisories)){
    const oldUrls=new Set(oldRail.advisories.map(item=>item.url));
    for(const item of newRail.advisories.slice(0,4))if(!oldUrls.has(item.url))changes.push({kind:'new_event_rail_advisory',observedAt,title:item.title,detail:'NJ TRANSIT added an advisory naming this MetLife game. Verify the publisher details; the listing does not establish disruption, train operation, venue impact, or a threat.',sourceUrl:item.url});
  }
  return changes.slice(0,12);
}
