export const MN_CAMERA_URL='https://data.dot.state.mn.us/iris/camera_pub';
export const MN_INCIDENT_URL='https://data.dot.state.mn.us/iris/incident';

export function requireSourceAge(lastModified,now,maxAgeMs){
  const updated=Date.parse(lastModified||'');
  if(!Number.isFinite(updated)||updated>now+60000||now-updated>maxAgeMs)throw Error('MnDOT IRIS source timestamp missing or stale');
  return new Date(updated).toISOString();
}

export function parseMinnesotaCameras(data){
  if(!Array.isArray(data)||data.length<500||data.length>5000)throw Error('Incomplete MnDOT IRIS camera inventory');
  return data.flatMap(item=>{
    const lat=Number(item?.lat),lon=Number(item?.lon);
    if(item?.publish!==true||!/^C\d{1,6}$/.test(item.name||'')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<43.4||lat>49.5||lon< -97.3||lon> -89.4)return [];
    return [{id:`mndot-${item.name}`,agency:'MnDOT IRIS',name:typeof item.location==='string'&&item.location.trim()?item.location.trim():'Road camera',lat,lon,route:typeof item.roadway==='string'?item.roadway:null,inService:null,operationalStatus:'Published in agency inventory; current image and view unverified',metadataDate:null,sourceUrl:MN_CAMERA_URL,viewerUrl:'https://511mn.org/cameras',...(item.streamable===true?{videoUrl:`https://video.dot.state.mn.us/public/${item.name}.stream/playlist.m3u8`}:{})}];
  });
}

export function parseMinnesotaIncidents(data){
  if(!Array.isArray(data)||data.length>500)throw Error('Incomplete MnDOT IRIS incident feed');
  return data.flatMap(item=>{
    const lat=Number(item?.lat),lon=Number(item?.lon),date=Date.parse(item?.event_date||'');
    if(!/^\d{10,20}$/.test(item?.name||'')||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<43.4||lat>49.5||lon< -97.3||lon> -89.4||!Number.isFinite(date))return [];
    return [{id:`mndot-incident-${item.name}`,agency:'MnDOT IRIS',kind:'MnDOT-listed active road incident',name:[item.road,item.direction].filter(x=>typeof x==='string'&&x.trim()).join(' · ')||'Road incident',detail:[item.description,item.lane_type].filter(x=>typeof x==='string'&&x.trim()).join(' · '),lat,lon,startAt:null,endAt:null,timingPolicy:'source_listed_only',sourceUrl:MN_INCIDENT_URL,sourceRecordDate:new Date(date).toISOString(),sourceConfirmed:item.confirmed===true}];
  });
}
