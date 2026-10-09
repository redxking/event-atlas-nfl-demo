export const MASSDOT_CCTV_LAYER='https://gisstg.massdot.state.ma.us/arcgis/rest/services/Assets/CCTV/MapServer/0';

export function massdotCameraQuery(){
  const params=new URLSearchParams({where:"Status='In Service'",geometry:'-71.5,41.9,-70.9,42.4',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'OBJECTID,Asset_ID,HOC_Display,Municipality,Status,Direction,last_edited_date',returnGeometry:'true',f:'json',resultRecordCount:'1000'});
  return `${MASSDOT_CCTV_LAYER}/query?${params}`;
}

export function parseMassdotCameraInventory(data){
  if(data?.error||!Array.isArray(data?.features)||data.features.length<200||data.exceededTransferLimit)throw Error('Incomplete MassDOT staging camera inventory');
  const result=[];
  for(const feature of data.features){
    const p=feature.attributes||{},lat=Number(feature.geometry?.y),lon=Number(feature.geometry?.x);
    if(!Number.isInteger(p.OBJECTID)||p.Status!=='In Service'||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<41.8||lat>42.5||lon< -71.7||lon> -70.7)continue;
    result.push({id:`massdot-staging-${p.OBJECTID}`,agency:'MassDOT staging GIS',name:String(p.HOC_Display||p.Asset_ID||'Road camera').slice(0,180),lat,lon,route:null,inService:null,operationalStatus:'Listed In Service in staging asset inventory; current service unverified',statusAsOf:null,metadataDate:null,sourceUrl:MASSDOT_CCTV_LAYER,viewerUrl:'https://mass511.com/list/cameras',viewerKind:'directory_only'});
  }
  if(result.length<200)throw Error('Insufficient valid MassDOT staging camera records');
  return result;
}
