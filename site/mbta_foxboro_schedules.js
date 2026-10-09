export const mbtaFoxboroScheduleSource='https://api-v3.mbta.com/schedules';
const stopId='place-FS-0049';
const routeId='CR-Foxboro';
const clean=value=>typeof value==='string'?value.trim().slice(0,160):'';
const time=value=>{if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(value))return null;const at=Date.parse(value);return Number.isFinite(at)?at:null};

export function foxboroServiceDate(game){
  const at=time(game?.kickoff);
  if(game?.venue?.id!=='3738'||at===null)throw Error('Dated Gillette game required');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function mbtaFoxboroSchedulesUrl(game){
  return mbtaFoxboroScheduleSource+'?'+new URLSearchParams({'filter[stop]':stopId,'filter[route]':routeId,'filter[date]':foxboroServiceDate(game),include:'trip','page[limit]':'100'});
}

export function summarizeMbtaFoxboroSchedules(body,game,checkedAt){
  const serviceDate=foxboroServiceDate(game),sourceUrl=mbtaFoxboroSchedulesUrl(game);
  if(!Number.isFinite(checkedAt)||!body||!Array.isArray(body.data)||body.data.length>100||body.included!==undefined&&!Array.isArray(body.included)||body.included?.length>100||body.errors?.length)throw Error('Bounded MBTA schedule response required');
  const kickoff=time(game.kickoff),screenable=!game.timeTbd&&kickoff>=checkedAt-9*3600000&&!/cancel/i.test(String(game.status||''));
  const windowStart=screenable?kickoff-4*3600000:null,windowEnd=screenable?kickoff+5*3600000:null;
  const trips=new Map((body.included||[]).filter(item=>item?.type==='trip'&&typeof item.id==='string').map(item=>[item.id,item.attributes]));
  const entries=[];let invalidCount=0;
  for(const item of body.data){
    const attributes=item?.attributes,relationships=item?.relationships;
    const id=item?.id,tripId=relationships?.trip?.data?.id,route=relationships?.route?.data?.id,stop=relationships?.stop?.data?.id;
    const arrival=time(attributes?.arrival_time),departure=time(attributes?.departure_time);
    if(item?.type!=='schedule'||typeof id!=='string'||id.length>180||!tripId||typeof tripId!=='string'||tripId.length>120||route!==routeId||!/^FS-0049(?:-[A-Z])?$/.test(String(stop))||arrival===null&&departure===null){invalidCount++;continue}
    const at=arrival??departure;
    if(Math.abs(at-kickoff)>36*3600000){invalidCount++;continue}
    entries.push({id,tripId,headsign:clean(trips.get(tripId)?.headsign)||null,arrivalAt:arrival===null?null:new Date(arrival).toISOString(),departureAt:departure===null?null:new Date(departure).toISOString(),directionId:attributes.direction_id===0||attributes.direction_id===1?attributes.direction_id:null,withinIllustrativeWindow:screenable&&at>=windowStart&&at<=windowEnd,sourceUrl:`https://api-v3.mbta.com/trips/${encodeURIComponent(tripId)}`});
  }
  entries.sort((a,b)=>Date.parse(a.arrivalAt||a.departureAt)-Date.parse(b.arrivalAt||b.departureAt));
  return {state:body.links?.next||invalidCount||body.data.length>0&&!body.included?'partial':'retrieved',checkedAt,sourceId:'mbta-foxboro-schedules',stopId,routeId,serviceDate,sourceUrl,totalReturned:body.data.length,invalidCount,screenable,eventWindow:{start:windowStart===null?null:new Date(windowStart).toISOString(),end:windowEnd===null?null:new Date(windowEnd).toISOString()},arrivalCount:entries.filter(item=>item.arrivalAt!==null).length,departureCount:entries.filter(item=>item.departureAt!==null).length,withinWindowCount:entries.filter(item=>item.withinIllustrativeWindow).length,omittedEntryCount:Math.max(0,entries.length-30),entries:entries.slice(0,30),interpretation:'Published MBTA station schedules are a service plan, not real-time train positions, ridership, guaranteed operation, or verified event access impact.'};
}
