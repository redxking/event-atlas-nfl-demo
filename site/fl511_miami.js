export const fl511MiamiUrl='https://www.fl511.com/list/events/traffic';

export function selectFl511Miami(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_area',asOf:null,sourceUrl:fl511MiamiUrl,records:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.venue?.id!=='3948'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const at=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.fl511-miami.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==fl511MiamiUrl||!Number.isFinite(at)||at>now+60000||now-at>2*3600000||!Number.isInteger(snapshot.countyCount)||!Array.isArray(snapshot.records)||snapshot.records.length!==snapshot.countyCount||snapshot.records.length>50)return {...empty,state:'stale_or_unavailable'};
  const valid=snapshot.records.every(item=>Number.isInteger(item.id)&&item.id>0&&item.sourceUrl===fl511MiamiUrl&&typeof item.type==='string'&&item.type.length<=60&&typeof item.roadway==='string'&&item.roadway.length<=120&&typeof item.description==='string'&&item.description.length<=350&&/^\d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2} [AP]M$/.test(item.lastUpdatedText||''));
  if(!valid||new Set(snapshot.records.map(item=>item.id)).size!==snapshot.records.length)return {...empty,state:'stale_or_unavailable'};
  return {...empty,state:'current_county_list',asOf:snapshot.checkedAt,countyCount:snapshot.countyCount,records:snapshot.records,interpretation:snapshot.interpretation};
}
