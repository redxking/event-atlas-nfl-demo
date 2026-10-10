const cueSource={
  'weather alert':['NWS point alerts','checked'],
  'road condition':['Road conditions','time screened'],
  'transit alert':['MBTA Foxboro station alerts','station alerts checked']
};
const rows=picture=>new Map((picture?.sources||[]).map(item=>[item.name,item]));
const cueKey=cue=>JSON.stringify([cue.type,cue.title,cue.sourceUrl,cue.sourceAt]);
const forecastKey=forecast=>JSON.stringify([forecast?.period?.startTime,forecast?.period?.endTime,forecast?.period?.shortForecast,forecast?.period?.temperature,forecast?.period?.temperatureUnit,forecast?.period?.windSpeed,forecast?.period?.windDirection,forecast?.period?.precipitationPercent]);

export function diffEventPicture(before,after,previousNews,currentNews,previousGame,currentGame,observedAt=new Date().toISOString()){
  if(!before||before.eventId!==after?.eventId)return [];
  const changes=[],oldRows=rows(before),newRows=rows(after);
  const eventWindowChanged=previousGame?.kickoff!==currentGame?.kickoff||previousGame?.status!==currentGame?.status||previousGame?.timeTbd!==currentGame?.timeTbd;
  if(eventWindowChanged)changes.push({kind:'schedule_changed',observedAt,title:'Published game time or status changed',detail:'Review the new schedule and repeat event-window screening. The change is not an incident finding.',sourceUrl:currentGame?.sourceUrl||null});
  for(const [name,next] of newRows){
    const prior=oldRows.get(name);
    if(prior&&prior.state!==next.state)changes.push({kind:'source_status_changed',observedAt,title:`${name}: ${prior.state} → ${next.state}`,detail:'Source coverage or screening status changed; verify the linked publisher before acting.',sourceUrl:next.sourceUrl||prior.sourceUrl||null});
  }
  if(!eventWindowChanged)for(const [type,[sourceName,goodState]] of Object.entries(cueSource)){
    if(oldRows.get(sourceName)?.state!==goodState||newRows.get(sourceName)?.state!==goodState)continue;
    const oldKeys=new Set((before.cues||[]).filter(cue=>cue.type===type).map(cueKey));
    for(const cue of (after.cues||[]).filter(cue=>cue.type===type))if(!oldKeys.has(cueKey(cue)))changes.push({kind:'newly_displayed_cue',observedAt,title:cue.title,detail:`New in this page's bounded ${type} sample. ${cue.basis} This is not a confirmed venue impact or threat.`,sourceUrl:cue.sourceUrl||null});
  }
  if(!eventWindowChanged&&before.forecastContext?.state==='current forecast'&&after.forecastContext?.state==='current forecast'&&before.forecastContext.sourceUrl===after.forecastContext.sourceUrl&&forecastKey(before.forecastContext)!==forecastKey(after.forecastContext))changes.push({kind:'forecast_changed',observedAt,title:'NWS kickoff forecast changed',detail:'The displayed hourly forecast values differ between two current checks. Verify the linked NWS forecast; this is not an observed hazard or threat.',sourceUrl:after.forecastContext.sourceUrl});
  if(previousNews?.state==='current_snapshot'&&currentNews?.state==='current_snapshot'){
    const oldUrls=new Set(previousNews.articles.map(item=>item.url));
    for(const item of currentNews.articles)if(!oldUrls.has(item.url))changes.push({kind:'newly_displayed_headline',observedAt,title:item.title,detail:`${item.publisher} RSS team mention, published ${item.publishedAt}. Verify that the article concerns this game; it does not establish attendance or a threat.`,sourceUrl:item.url});
  }
  return changes.slice(0,12);
}
