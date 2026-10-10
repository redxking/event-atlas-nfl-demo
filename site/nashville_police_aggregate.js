export const nashvillePoliceLayer='https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Metro_Nashville_Police_Department_Active_Dispatch_Table_view/FeatureServer/0';
export const nashvillePolicePage='https://www.nashville.gov/departments/police/online-resources/active-dispatches';
const HOUR=3600000;

export function validateNashvillePoliceCount(metadata,result,checkedAt=Date.now()){
  const updated=metadata?.editingInfo?.dataLastEditDate;
  if(metadata?.type!=='Table'||metadata.name!=='MetroNashvillePoliceDepartmentActiveDispatch'||!String(metadata.capabilities||'').split(',').includes('Query')||!Number.isSafeInteger(updated)||updated>checkedAt+60000||checkedAt-updated>30*60000)throw Error('Nashville active-dispatch table metadata is stale or unexpected');
  if(!Number.isSafeInteger(result?.count)||result.count<0||result.count>10000||result.error)throw Error('Nashville count-only response is invalid');
  return {schema:'event-atlas.nashville-police-count.v1',status:'ok',checkedAt:new Date(checkedAt).toISOString(),sourceUpdatedAt:new Date(updated).toISOString(),scope:'Metro Nashville Police current active major dispatches citywide',activeCount:result.count,sourceUrl:nashvillePoliceLayer,agencyPageUrl:nashvillePolicePage,interpretation:'Citywide active major calls for service. This count contains no call identifiers, locations, types, or person data. It is not a stadium-area count, live alert, incident verification, trend, or threat finding.'};
}

export function selectNashvillePoliceCount(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_area',checkedAt:null,sourceUpdatedAt:null,activeCount:null,sourceUrl:nashvillePoliceLayer,agencyPageUrl:nashvillePolicePage};
  if(game?.venue?.id!=='3810')return empty;
  const checked=Date.parse(snapshot?.checkedAt),updated=Date.parse(snapshot?.sourceUpdatedAt);
  if(snapshot?.schema!=='event-atlas.nashville-police-count.v1'||snapshot.status!=='ok'||snapshot.scope!=='Metro Nashville Police current active major dispatches citywide'||snapshot.sourceUrl!==nashvillePoliceLayer||snapshot.agencyPageUrl!==nashvillePolicePage||!Number.isSafeInteger(snapshot.activeCount)||snapshot.activeCount<0||snapshot.activeCount>10000||!Number.isFinite(checked)||!Number.isFinite(updated)||checked>now+60000||updated>checked+60000||now-checked>2*HOUR||checked-updated>30*60000)return {...empty,state:'stale_or_unavailable'};
  return {state:'current_citywide_count',checkedAt:snapshot.checkedAt,sourceUpdatedAt:snapshot.sourceUpdatedAt,activeCount:snapshot.activeCount,sourceUrl:nashvillePoliceLayer,agencyPageUrl:nashvillePolicePage,interpretation:snapshot.interpretation};
}
