import {pointInsideRing} from './ground_relevance.js';

export const FAA_TFR_LIST='https://tfr.faa.gov/tfrapi/getTfrList';
export const FAA_TFR_GEOMETRY='https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=300&outputFormat=application/json&srsname=EPSG:4326';

export function selectTfrVenueIntersections(venues,list,geo){
  if(!Array.isArray(venues)||!Array.isArray(list)||!Array.isArray(geo?.features)||geo.features.length>=300||geo.exceededTransferLimit)throw Error('FAA TFR source response incomplete');
  const notices=new Map();
  for(const item of list){
    if(!/^\d+\/\d{4}$/.test(item?.notam_id||''))continue;
    notices.set(item.notam_id,{notamId:item.notam_id,type:String(item.type||'').slice(0,100),description:String(item.description||'').slice(0,300),state:String(item.state||'').slice(0,10),facility:String(item.facility||'').slice(0,30),sourceModified:String(item.mod_date||'').slice(0,40)});
  }
  const byVenue={};
  for(const venue of venues){
    if(!venue?.id||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon))continue;
    const matched=new Map();
    for(const feature of geo.features){
      const key=feature?.properties?.NOTAM_KEY;
      if(typeof key!=='string'||!/^\d+\/\d{4}-\d+-[A-Z]+-[A-Z]+$/.test(key))continue;
      const notice=notices.get(key.split('-')[0]);
      if(!notice||feature.geometry?.type!=='Polygon')continue;
      const ring=feature.geometry.coordinates?.[0];
      if(!Array.isArray(ring)||ring.length<4||ring.length>500||!ring.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90))continue;
      if(!pointInsideRing(venue,ring))continue;
      const prior=matched.get(notice.notamId);
      if(prior){prior.shapeCount++;continue}
      matched.set(notice.notamId,{...notice,notamKey:key,detailUrl:`https://tfr.faa.gov/tfr3/?page=detail_${notice.notamId.replace('/','_')}`,matchBasis:'Unreviewed venue candidate point intersects an FAA-published TFR shape; spatial relation alone does not link the notice to the NFL event.',shapeCount:1,ring:ring.map(([lon,lat])=>[Number(lon.toFixed(6)),Number(lat.toFixed(6))])});
    }
    if(matched.size)byVenue[venue.id]=[...matched.values()].sort((a,b)=>a.notamId.localeCompare(b.notamId));
  }
  return byVenue;
}
