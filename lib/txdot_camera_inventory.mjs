export const TXDOT_CCTV_LAYER='https://maps.txdot.gov/createags/rest/services/Hosted/CCTV_Point/FeatureServer/3';

export function txdotCameraQuery(){
  const params=new URLSearchParams({where:'1=1',geometry:'-97.25,32.68,-96.9,32.85',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'objectid,highway,name,latitude,longitude',returnGeometry:'true',f:'json',resultRecordCount:'1000'});
  return `${TXDOT_CCTV_LAYER}/query?${params}`;
}

export function parseTxdotCameraInventory(layer,data,now=Date.now()){
  const lastEdit=Number(layer?.editingInfo?.lastEditDate);
  if(!Number.isFinite(lastEdit)||lastEdit<=0||lastEdit>now+3600000||now-lastEdit>90*86400000)throw Error('TxDOT camera asset inventory edit date unavailable or older than 90 days');
  if(!Array.isArray(data?.features)||data.features.length<20||data.error||data.exceededTransferLimit)throw Error('Incomplete TxDOT Dallas-area camera inventory');
  const metadataDate=new Date(lastEdit).toISOString().slice(0,10);
  const records=[];
  for(const feature of data.features){
    const item=feature.attributes||{},lat=Number(item.latitude),lon=Number(item.longitude);
    if(!Number.isInteger(item.objectid)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<32.6||lat>32.9||lon< -97.3||lon> -96.8)continue;
    records.push({id:`txdot-${item.objectid}`,agency:'TxDOT GIS',name:String(item.name||'Road camera').slice(0,160),lat,lon,route:item.highway?String(item.highway).slice(0,80):null,inService:null,operationalStatus:'Asset inventory; live status unverified',metadataDate,sourceUrl:TXDOT_CCTV_LAYER,viewerUrl:'https://www.txdot.gov/discover/live-traffic-cameras.html',viewerKind:'directory_only'});
  }
  if(records.length<20)throw Error('Insufficient valid TxDOT Dallas-area camera records');
  return {records,sourceUpdatedAt:new Date(lastEdit).toISOString()};
}
