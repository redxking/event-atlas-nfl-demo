export const MODOT_CAMERA_LAYER='https://mapping.modot.mo.gov/arcgis/rest/services/TravelerInformation/NWSDATA/MapServer/0';

export function modotCameraQuery(){
  const params=new URLSearchParams({
    f:'json',where:'1=1',
    geometry:JSON.stringify({xmin:-94.8,ymin:38.8,xmax:-94.2,ymax:39.3,spatialReference:{wkid:4326}}),
    geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',
    outFields:'CAM_ID,DESCRIPTION',returnGeometry:'true',outSR:'4326',resultRecordCount:'1000'
  });
  return `${MODOT_CAMERA_LAYER}/query?${params}`;
}

export function parseModotCameraInventory(data){
  if(data?.error||!Array.isArray(data?.features)||data.exceededTransferLimit||data.features.length>1000)throw Error('Incomplete MoDOT camera inventory');
  const records=[],seen=new Set();
  for(const feature of data.features){
    const item=feature?.attributes||{},lat=Number(feature?.geometry?.y),lon=Number(feature?.geometry?.x);
    if(!Number.isSafeInteger(item.CAM_ID)||item.CAM_ID<1||seen.has(item.CAM_ID)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<38.8||lat>39.3||lon< -94.8||lon> -94.2)continue;
    seen.add(item.CAM_ID);
    const viewer=new URL('https://traveler.modot.org/map/index.html');
    viewer.search=new URLSearchParams({cx:String(lon),cy:String(lat)}).toString();
    records.push({id:`modot-${item.CAM_ID}`,agency:'MoDOT Traveler Information',name:String(item.DESCRIPTION||'Road camera').slice(0,160),lat,lon,route:null,inService:null,operationalStatus:'Publisher camera inventory; current image status unverified',metadataDate:null,sourceUrl:MODOT_CAMERA_LAYER,viewerUrl:viewer.href,viewerKind:'directory_only'});
  }
  return records;
}
