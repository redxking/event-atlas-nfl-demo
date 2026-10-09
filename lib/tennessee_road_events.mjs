const DAY=86400000;

export function parseTennesseeRoadEvents(features,now,seasonEnd,sourceUrl){
  if(!Array.isArray(features))throw Error('Tennessee road features required');
  const records=[];
  for(const feature of features){
    const p=feature.attributes||{},lat=Number(feature.geometry?.y),lon=Number(feature.geometry?.x);
    const start=Number(p.START_DATE),end=p.END_DATE==null?null:Number(p.END_DATE),revised=Number(p.REVISED_DATE);
    if(!Number.isSafeInteger(p.OBJECTID)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<35.9||lat>36.35||lon< -87.05||lon> -86.6||!Number.isFinite(start)||!Number.isFinite(revised)||start<=0||revised<=0||start>seasonEnd||start>now+DAY*90||revised>now+3600000)continue;
    const incident=p.EVENT_TYPE==='Incident';
    if(now-revised>(incident?DAY:7*DAY)||incident&&start>now||end!==null&&(!Number.isFinite(end)||end<=start||end<now))continue;
    records.push({id:`tdot-smartway-${p.OBJECTID}`,agency:'Tennessee DOT SmartWay',kind:incident?'Agency-listed road incident':'Agency-listed road operation',name:p.CD_ROAD_NAMES||p.EVENT_SUBTYPE||p.EVENT_TYPE||'Road event',detail:String(p.DESCRIPTION||'').slice(0,1000),lat,lon,startAt:null,endAt:null,sourceRecordDate:null,sourceUrl,sourceHasClosure:p.HAS_CLOSURE===1,timingPolicy:'source_listed_only',timeNote:'Agency numeric date fields are not displayed as UTC; source time-zone semantics need confirmation.'});
  }
  return records;
}
