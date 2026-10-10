export const LA511_CAMERA_API='https://511la.org/api/v2/get/cameras';
export const LA511_CAMERA_DOC='https://511la.org/help/endpoint/cameras';
export const LA511_CAMERA_PAGE='https://511la.org/cctv';
export const LA511_PUBLIC_LIST='https://511la.org/List/GetData/Cameras';

export function louisianaPublicListUrl(start){
  const url=new URL(LA511_PUBLIC_LIST);
  url.searchParams.set('query',JSON.stringify({start,length:100,columns:[{name:'sortOrder'},{name:'roadway',s:true}]}));
  return url;
}

const publicVideo=url=>/^https:\/\/itsstreaming[a-z0-9-]*\.dotd\.la\.gov\/public\/[A-Za-z0-9_-]+\.streams?\/playlist\.m3u8$/i.test(url);

export function parseLouisianaPublicCameraList(pages){
  if(!Array.isArray(pages)||!pages.length)throw Error('Louisiana 511 public camera list unavailable');
  const total=pages[0]?.recordsTotal;
  if(!Number.isSafeInteger(total)||total<100||total>5000||pages.some(page=>page.recordsTotal!==total||!Array.isArray(page.data)))throw Error('Invalid Louisiana 511 public camera list');
  const rows=pages.flatMap(page=>page.data);
  if(rows.length!==total||new Set(rows.map(row=>row.id)).size!==total)throw Error('Incomplete Louisiana 511 public camera list');
  const records=[];
  for(const camera of rows){
    const match=camera.latLng?.geography?.wellKnownText?.match(/^POINT \((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/);
    if(!Number.isSafeInteger(camera.id)||!match||!Array.isArray(camera.images))continue;
    const lon=Number(match[1]),lat=Number(match[2]);
    if(lat<28.8||lat>33.1||lon< -94.1||lon> -88.7)continue;
    for(const view of camera.images){
      if(!Number.isSafeInteger(view.id)||view.disabled||view.blocked||view.videoDisabled||view.isVideoAuthRequired)continue;
      const videoUrl=String(view.videoUrl||'');
      records.push({id:`la511-${camera.id}-${view.id}`,agency:'Louisiana 511',name:String(camera.location||camera.roadway||'Road camera').slice(0,150),lat,lon,route:String(camera.roadway||'').slice(0,80)||null,direction:String(camera.direction||'').slice(0,40)||null,inService:true,operationalStatus:'View listed on public 511 page; current frames unverified',sourceUrl:LA511_CAMERA_PAGE,viewerUrl:`https://511la.org/map/Cctv/${view.id}`,...(publicVideo(videoUrl)?{videoUrl}:{})});
    }
  }
  if(records.length<100)throw Error('Insufficient available Louisiana 511 public camera views');
  return records;
}

export function parseLouisianaCameras(data){
  if(!Array.isArray(data)||data.length<100)throw Error('Incomplete Louisiana 511 camera inventory');
  const records=[];
  for(const camera of data){
    const lat=Number(camera?.Latitude),lon=Number(camera?.Longitude);
    if(!Number.isSafeInteger(camera?.Id)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<28.8||lat>33.1||lon< -94.1||lon> -88.7||!Array.isArray(camera.Views))continue;
    for(const view of camera.Views){
      if(!Number.isSafeInteger(view?.Id)||view.Status!=='Enabled')continue;
      const videoUrl=String(view.VideoUrl||'');
      const allowedVideo=publicVideo(videoUrl);
      records.push({id:`la511-${camera.Id}-${view.Id}`,agency:'Louisiana 511',name:String(camera.Location||camera.Roadway||'Road camera').slice(0,150),lat,lon,route:String(camera.Roadway||'').slice(0,80)||null,direction:String(camera.Direction||'').slice(0,40)||null,inService:true,operationalStatus:'View enabled in 511 inventory; current frames unverified',sourceUrl:LA511_CAMERA_DOC,viewerUrl:`https://511la.org/map/Cctv/${view.Id}`,...(allowedVideo?{videoUrl}:{})});
    }
  }
  if(records.length<100)throw Error('Insufficient enabled Louisiana 511 camera views');
  return records;
}
