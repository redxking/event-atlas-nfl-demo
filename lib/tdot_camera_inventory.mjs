export const TDOT_CONFIG_URL='https://smartway.tn.gov/config/config.prod.json';
export const TDOT_CAMERA_API='https://www.tdot.tn.gov/opendata/api/public/RoadwayCameras';

export function tdotCameraRequestConfig(config){
  if(config?.apiBaseUrl!=='https://www.tdot.tn.gov/opendata/api/public/'||config?.cameras!=='RoadwayCameras'||typeof config.apiKey!=='string'||!/^[a-f0-9]{32}$/i.test(config.apiKey))throw Error('TDOT public camera configuration changed');
  return {url:TDOT_CAMERA_API,headers:{ApiKey:config.apiKey}};
}

export function parseTdotCameraInventory(raw){
  if(!Array.isArray(raw)||raw.length<100||raw.length>2000)throw Error('Incomplete TDOT public camera inventory');
  const records=[];
  for(const item of raw){
    const id=Number(item?.id),lat=Number(item?.lat),lon=Number(item?.lng),name=item?.name;
    if(item?.jurisdiction!=='Nashville'||item?.active!=='true'||!Number.isSafeInteger(id)||id<1||id>999999||!Number.isFinite(lat)||lat<35.9||lat>36.4||!Number.isFinite(lon)||lon< -87.1||lon> -86.5||!/^R3_\d{3}$/.test(name||''))continue;
    const videoUrl=item.httpsVideoUrl;
    const allowedVideo=typeof videoUrl==='string'&&new RegExp(`^https://mcleansfs[1-9]\\d*\\.us-east-1\\.skyvdn\\.com/rtplive/${name}/playlist\\.m3u8$`).test(videoUrl);
    const stillUrl=item.thumbnailUrl;
    const allowedStill=typeof stillUrl==='string'&&stillUrl===`https://tnsnapshots.com/thumbs/${name}.flv.png`;
    records.push({id:`tdot-smartway-${id}`,agency:'TDOT SmartWay',name:String(item.description||item.title||'Nashville roadway camera').slice(0,160),lat,lon,route:typeof item.route==='string'?item.route.slice(0,30):null,inService:true,operationalStatus:'Listed active by TDOT; live playback not independently verified',metadataDate:null,sourceUrl:TDOT_CAMERA_API,viewerUrl:`https://smartway.tn.gov/allcams/camera/${id}`,...(allowedStill?{stillUrl}:{}),...(allowedVideo?{videoUrl}:{})});
  }
  if(records.length<100)throw Error('Insufficient valid Nashville TDOT cameras');
  return records;
}
