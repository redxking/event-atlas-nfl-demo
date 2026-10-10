export const LA511_CAMERA_API='https://511la.org/api/v2/get/cameras';
export const LA511_CAMERA_DOC='https://511la.org/help/endpoint/cameras';

export function parseLouisianaCameras(data){
  if(!Array.isArray(data)||data.length<100)throw Error('Incomplete Louisiana 511 camera inventory');
  const records=[];
  for(const camera of data){
    const lat=Number(camera?.Latitude),lon=Number(camera?.Longitude);
    if(!Number.isSafeInteger(camera?.Id)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<28.8||lat>33.1||lon< -94.1||lon> -88.7||!Array.isArray(camera.Views))continue;
    for(const view of camera.Views){
      if(!Number.isSafeInteger(view?.Id)||view.Status!=='Enabled')continue;
      const videoUrl=String(view.VideoUrl||'');
      const allowedVideo=/^https:\/\/itsstreaming[a-z0-9-]*\.dotd\.la\.gov\/public\/[A-Za-z0-9_-]+\.streams?\/playlist\.m3u8$/i.test(videoUrl);
      records.push({id:`la511-${camera.Id}-${view.Id}`,agency:'Louisiana 511',name:String(camera.Location||camera.Roadway||'Road camera').slice(0,150),lat,lon,route:String(camera.Roadway||'').slice(0,80)||null,direction:String(camera.Direction||'').slice(0,40)||null,inService:true,operationalStatus:'View enabled in 511 inventory; current frames unverified',sourceUrl:LA511_CAMERA_DOC,viewerUrl:`https://511la.org/map/Cctv/${view.Id}`,...(allowedVideo?{videoUrl}:{})});
    }
  }
  if(records.length<100)throw Error('Insufficient enabled Louisiana 511 camera views');
  return records;
}
