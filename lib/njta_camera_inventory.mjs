export const NJTA_CAMERA_PAGE='https://www.njta.gov/travel-resources/camera-list/';
const decode=value=>String(value||'').replace(/&(?:quot|amp|lt|gt|#39|apos);/g,entity=>({'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&#39;':"'",'&apos;':"'"}[entity]));

export function parseNjtaCameraInventory(html){
  if(typeof html!=='string'||html.length>2500000)throw Error('Unexpected NJTA camera page');
  const raw=html.match(/data-block-config="([^"]{1000,400000})"/i)?.[1];
  if(!raw)throw Error('NJTA camera catalog unavailable');
  const config=JSON.parse(decode(raw));
  if(config?.mode!=='traffic-cameras')throw Error('Unexpected NJTA camera catalog mode');
  const groups=config.initialData?.cameras;
  if(!Array.isArray(groups?.turnpike)||!Array.isArray(groups?.parkway))throw Error('Incomplete NJTA camera catalog');
  const all=[...groups.turnpike.map(item=>({item,roadway:'New Jersey Turnpike'})),...groups.parkway.map(item=>({item,roadway:'Garden State Parkway'}))];
  if(all.length<100||all.length>500)throw Error('Unexpected NJTA camera count');
  const records=[];
  for(const {item,roadway} of all){
    const id=Number(item?.id),lat=Number(item?.lat),lon=Number(item?.lng),url=item?.video_url;
    if(!Number.isSafeInteger(id)||id<1||id>100000||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<38.8||lat>41.6||lon< -75.7||lon> -73.7||typeof url!=='string'||!/^https:\/\/wink\.njta\.com\/\d{1,4}\/public\/hls\/[A-Za-z0-9-]+_nj\.m3u8$/.test(url))continue;
    const marker=item.mile_marker==null?null:Number(item.mile_marker);
    const name=`${roadway}${Number.isFinite(marker)?` MM ${marker}`:''} ${String(item.relative_direction||'').slice(0,12)} of ${String(item.relative_text||'roadway').slice(0,100)}`.replace(/\s+/g,' ').trim();
    records.push({id:`njta-${id}`,agency:'NJTA',name,lat,lon,route:roadway,inService:null,operationalStatus:'Public stream listed; playback not yet verified',metadataDate:null,sourceUrl:NJTA_CAMERA_PAGE,viewerUrl:NJTA_CAMERA_PAGE,videoUrl:url});
  }
  if(records.length<100)throw Error('Insufficient valid NJTA camera records');
  if(new Set(records.map(item=>item.id)).size!==records.length)throw Error('Duplicate NJTA camera IDs');
  return records;
}
