import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file=path.join(root,'data/voting_locations.json');
const sourceId='pa-polling-may-2026';
const base='https://services3.arcgis.com/dBSpWiMm4bd648G0/arcgis/rest/services/PP_May_07_2026_ESRI_Google_Final/FeatureServer/0';
const item='https://www.arcgis.com/home/item.html?id=8c98bb0313644edd9ad8c3ccdb490cff';
const note='Pennsylvania Department of State statewide polling-place reference dated May 7, 2026. Rows can repeat a physical site by precinct; geocoded points are estimates, not entrances or voter assignments. Confirm current operation with the county election office.';
const clean=value=>value==null?'':String(value).trim();

async function json(url){let last;for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(url,{headers:{'User-Agent':'EventAtlas/0.4 (local public-data evaluation)'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const data=await response.json();if(data.error)throw Error(JSON.stringify(data.error));return data}catch(error){last=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)))}}throw last}

export function normalizePennsylvania(feature,retrievedAt){
  const p=feature.attributes||{},point=feature.geometry||{};
  const id=p.OBJECTID,lat=point.y,lon=point.x;
  if(!Number.isSafeInteger(id)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<39.5||lat>42.6||lon< -80.7||lon> -74.3)throw Error(`Invalid Pennsylvania row or geometry: ${id}`);
  const name=clean(p.USER_Description),street=clean(p.USER_StreetAddress),city=clean(p.USER_City),county=clean(p.USER_CountyName);
  if(!name||!street||!city||!county||clean(p.USER_State)!=='PA')throw Error(`Missing Pennsylvania identity or address: ${id}`);
  return {id:`${sourceId}:${id}`,sourceId,sourceRecordId:id,name,type:'election_day_polling_place',jurisdiction:'PA',county,city,street,addressLine2:clean(p.USER_Line2),postal:clean(p.USER_PostalCode),lat,lon,precinct:clean(p.USER_PrecinctName)||null,precinctCode:clean(p.USER_PrecinctCode)||null,precinctSplitCode:clean(p.USER_PrecinctSplitCode)||null,ward:'',status:'May 2026 polling-place reference; election-specific status not supplied',datesOpen:'',hours:'',votingSpace:'',accessibility:clean(p.USER_HandicapAccessible),facilityClassification:clean(p.USER_PollingPlaceClassification),geocodeMatchStatus:clean(p.Status),geocodeMatchScore:Number.isFinite(p.Score)?p.Score:null,sourceUrl:base,sourceRecordUrl:`${base}/query?where=OBJECTID%3D${id}&outFields=*&returnGeometry=true&outSR=4326&f=json`,sourceDataStatus:note,retrievedAt,sourceEditedAt:null};
}

export async function fetchPennsylvania(retrievedAt){
  const meta=await json(`${base}?f=json`);
  const idsResult=await json(`${base}/query?where=1%3D1&returnIdsOnly=true&f=json`);
  const ids=idsResult.objectIds;
  if(!Array.isArray(ids)||ids.length<1000||new Set(ids).size!==ids.length)throw Error('Missing, implausible, or duplicate Pennsylvania ID list');
  const byId=new Map();
  for(let index=0;index<ids.length;index+=150){
    const q=new URLSearchParams({objectIds:ids.slice(index,index+150).join(','),outFields:'*',returnGeometry:'true',outSR:'4326',f:'json'});
    const page=await json(`${base}/query?${q}`);
    if(!Array.isArray(page.features)||page.exceededTransferLimit)throw Error(`Incomplete Pennsylvania page at ${index}`);
    for(const feature of page.features){const row=normalizePennsylvania(feature,retrievedAt);if(byId.has(row.sourceRecordId))throw Error(`Duplicate Pennsylvania row ${row.sourceRecordId}`);byId.set(row.sourceRecordId,row)}
  }
  if(byId.size!==ids.length||ids.some(id=>!byId.has(id)))throw Error(`Pennsylvania expected ${ids.length}, received ${byId.size}`);
  return {source:{id:sourceId,name:'Pennsylvania Department of State May 2026 polling places',dataset:base,item,records:byId.size,reportedCount:ids.length,retrievedAt,dataEditedAt:meta.editingInfo?.dataLastEditDate?new Date(meta.editingInfo.dataLastEditDate).toISOString():null,coverageNote:note,status:'ok'},locations:[...byId.values()]};
}

async function main(){
  const snapshot=JSON.parse(await fs.readFile(file,'utf8'));
  const retrievedAt=new Date().toISOString();
  let result;
  try{result=await fetchPennsylvania(retrievedAt);console.log(`${sourceId}: ${result.locations.length}`)}
  catch(error){const locations=snapshot.locations.filter(row=>row.sourceId===sourceId),prior=snapshot.sources.find(source=>source.id===sourceId);result={source:{id:sourceId,name:'Pennsylvania Department of State May 2026 polling places',dataset:base,item,records:locations.length,retrievedAt,lastSuccessfulAt:prior?.status==='ok'?prior.retrievedAt:prior?.lastSuccessfulAt||null,coverageNote:note,status:locations.length?'stale_retained':'error',error:String(error.message)},locations};console.error(`${sourceId}: ${error.message}; retained ${locations.length} prior records`)}
  const locations=[...snapshot.locations.filter(row=>row.sourceId!==sourceId),...result.locations];
  const sources=[...snapshot.sources.filter(source=>source.id!==sourceId),result.source];
  const output={...snapshot,retrievedAt,coverageNote:'Official-source voting site-type rows; consult each source for covered jurisdiction, election, freshness, and coordinate limits. National coverage is incomplete; failed sources retain prior rows with stale status.',sources,locations};
  await fs.writeFile(file+'.tmp',JSON.stringify(output));await fs.rename(file+'.tmp',file);
  console.log(`Wrote ${locations.length} voting-site rows to ${file}`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error);process.exitCode=1});
