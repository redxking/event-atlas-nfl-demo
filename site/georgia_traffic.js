export const georgiaTrafficUrl='https://incidentreport.dot.ga.gov/traffic';
export const georgiaTrafficPage='https://incidentreport.dot.ga.gov/';
const wallTime=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value);

export function selectGeorgiaTraffic(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:georgiaTrafficUrl,sourcePageUrl:georgiaTrafficPage,records:[],countyCount:null};
  if(game?.id!=='nfl:401872993'||game?.venue?.id!=='5348'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-12'))return empty;
  const at=Date.parse(snapshot?.retrievedAt);
  if(snapshot?.schema!=='event-atlas.georgia-traffic.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==georgiaTrafficUrl||snapshot.sourcePageUrl!==georgiaTrafficPage||snapshot.sourceCounty!=='Fulton'||snapshot.timeBasis!=='publisher_displayed_wall_time_unverified_zone'||!Number.isSafeInteger(snapshot.totalReturned)||snapshot.totalReturned<0||snapshot.totalReturned>1000||!Number.isSafeInteger(snapshot.countyCount)||snapshot.countyCount<0||snapshot.countyCount>snapshot.totalReturned||!Number.isSafeInteger(snapshot.recentCountyCount)||snapshot.recentCountyCount<0||snapshot.recentCountyCount>snapshot.countyCount||!Number.isSafeInteger(snapshot.olderOmittedCount)||snapshot.olderOmittedCount!==snapshot.countyCount-snapshot.recentCountyCount||!Array.isArray(snapshot.records)||snapshot.records.length>10||!Number.isFinite(at)||at>now+60000||now-at>2*3600000)return {...empty,state:'stale_or_unavailable'};
  const records=snapshot.records.filter(item=>/^gdot-\d+$/.test(item?.id||'')&&item.sourceUrl===georgiaTrafficPage&&wallTime(item.publisherDisplayedUpdated)&&[item.category,item.type,item.publisherStatus,item.road,item.crossRoad,item.detail].every(value=>typeof value==='string'&&value.length<=300)&&(!item.publisherDisplayedStart||wallTime(item.publisherDisplayedStart))&&(!item.publisherDisplayedEnd||wallTime(item.publisherDisplayedEnd)));
  if(records.length!==snapshot.records.length||new Set(records.map(item=>item.id)).size!==records.length)return {...empty,state:'stale_or_unavailable'};
  return {state:'current_retrieval_time_basis_unverified',asOf:snapshot.retrievedAt,sourceUrl:georgiaTrafficUrl,sourcePageUrl:georgiaTrafficPage,countyCount:snapshot.countyCount,recentCountyCount:snapshot.recentCountyCount,olderOmittedCount:snapshot.olderOmittedCount,totalReturned:snapshot.totalReturned,records,interpretation:snapshot.interpretation};
}
