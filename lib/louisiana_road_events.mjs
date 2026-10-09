export function parseLouisianaRoadEvents(features,now,seasonEnd,sourceUrl){
  const byId=new Map();
  for(const feature of features){
    const p=feature.attributes||{},lat=Number(feature.geometry?.y),lon=Number(feature.geometry?.x);
    const start=Number(p.EventStartDateUTC),end=Number(p.EventEndDateUTC),updated=Number(p.EventLastUpdatedUTC);
    if(!Number.isInteger(p.EventID)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<29.8||lat>30.2||lon< -90.3||lon> -89.8||
      !Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(updated)||start<=0||end<=start||end<now||start>seasonEnd||
      updated<now-7*86400000||updated>now+3600000||p.EventStatus==='Ended')continue;
    const existing=byId.get(p.EventID);
    if(existing&&Date.parse(existing.sourceRecordDate)>=updated)continue;
    byId.set(p.EventID,{id:`ladotd-511-${p.EventID}`,agency:'Louisiana DOTD 511',kind:'DOTD-listed road event',
      name:[p.RoadName,p.EventType].filter(Boolean).join(' · ')||'Unnamed road event',
      detail:p.Description||'',lat,lon,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),
      sourceUrl,sourceRecordDate:new Date(updated).toISOString(),sourceStatus:p.EventStatus||null});
  }
  return [...byId.values()];
}
