export const mbtaFoxboroPredictionsUrl='https://api-v3.mbta.com/predictions?'+new URLSearchParams({'filter[stop]':'place-FS-0049','filter[route]':'CR-Foxboro',include:'trip','page[limit]':'100'});
const predictedTime=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value))return null;const at=Date.parse(value);return Number.isFinite(at)?at:null};
const clean=value=>typeof value==='string'?value.trim().slice(0,160):'';

export function summarizeMbtaFoxboroPredictions(body,checkedAt){
  if(!Number.isFinite(checkedAt)||!body||!Array.isArray(body.data)||body.data.length>100||body.included!==undefined&&!Array.isArray(body.included)||body.included?.length>100||body.errors?.length)throw Error('Bounded MBTA prediction response required');
  const trips=new Map((body.included||[]).filter(item=>item?.type==='trip'&&typeof item.id==='string').map(item=>[item.id,item.attributes]));
  const entries=[];let invalidCount=0;
  for(const item of body.data){
    const route=item?.relationships?.route?.data?.id,stop=item?.relationships?.stop?.data?.id,tripId=item?.relationships?.trip?.data?.id;
    const arrival=predictedTime(item?.attributes?.arrival_time),departure=predictedTime(item?.attributes?.departure_time);
    const at=arrival??departure;
    if(item?.type!=='prediction'||typeof item.id!=='string'||item.id.length>180||route!=='CR-Foxboro'||!/^FS-0049(?:-[A-Z])?$/.test(String(stop))||typeof tripId!=='string'||tripId.length>120||at===null||at<checkedAt-2*3600000||at>checkedAt+24*3600000){invalidCount++;continue}
    entries.push({tripId,headsign:clean(item.attributes.trip_headsign)||clean(trips.get(tripId)?.headsign)||null,arrivalAt:arrival===null?null:new Date(arrival).toISOString(),departureAt:departure===null?null:new Date(departure).toISOString(),status:clean(item.attributes.status)||null,sourceUrl:`https://api-v3.mbta.com/trips/${encodeURIComponent(tripId)}`});
  }
  entries.sort((a,b)=>Date.parse(a.arrivalAt||a.departureAt)-Date.parse(b.arrivalAt||b.departureAt));
  return {state:body.links?.next||invalidCount?'partial':'retrieved',checkedAt,sourceId:'mbta-foxboro-predictions',sourceUrl:mbtaFoxboroPredictionsUrl,stopId:'place-FS-0049',routeId:'CR-Foxboro',totalReturned:body.data.length,invalidCount,omittedEntryCount:Math.max(0,entries.length-20),entries:entries.slice(0,20),interpretation:'Current MBTA prediction records are estimates at Foxboro station. Empty results do not establish service cancellation, no future game trains, or absence of transit risk; this feed is not a train-position sensor.'};
}
