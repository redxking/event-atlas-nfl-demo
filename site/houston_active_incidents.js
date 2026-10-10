export const houstonActiveIncidentsPage='https://cohweb.houstontx.gov/ActiveIncidents/Combined.aspx';
const schema='event-atlas.houston-active-incidents-count.v1';

export function selectHoustonActiveIncidents(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_area',checkedAt:null,fireEmsCount:null,policeCount:null,totalCount:null,sourceUrl:houstonActiveIncidentsPage};
  if(game?.venue?.id!=='3891')return empty;
  const checked=Date.parse(snapshot?.checkedAt),httpAt=Date.parse(snapshot?.sourceHttpAt);
  if(snapshot?.schema!==schema||snapshot?.status!=='ok'||snapshot?.scope!=='Houston Fire/EMS and Police active incidents citywide'||snapshot?.sourceUrl!==houstonActiveIncidentsPage||!Number.isFinite(checked)||!Number.isFinite(httpAt)||checked>now+60000||httpAt>checked+300000||Math.abs(checked-httpAt)>300000||now-checked>2*3600000||!['fireEmsCount','policeCount','totalCount'].every(key=>Number.isSafeInteger(snapshot[key])&&snapshot[key]>=0&&snapshot[key]<=1000)||snapshot.fireEmsCount+snapshot.policeCount!==snapshot.totalCount)return {...empty,state:'stale_or_unavailable'};
  return {state:'current_citywide_count',checkedAt:snapshot.checkedAt,sourceHttpAt:snapshot.sourceHttpAt,fireEmsCount:snapshot.fireEmsCount,policeCount:snapshot.policeCount,totalCount:snapshot.totalCount,sourceUrl:houstonActiveIncidentsPage,interpretation:snapshot.interpretation};
}
