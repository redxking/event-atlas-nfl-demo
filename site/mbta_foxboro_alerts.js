export const mbtaFoxboroStopId='place-FS-0049';
export const mbtaFoxboroAlertsUrl='https://api-v3.mbta.com/alerts?'+new URLSearchParams({'filter[stop]':mbtaFoxboroStopId,'page[limit]':'100'});

const validTime=value=>{if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(value))return null;const at=Date.parse(value);return Number.isFinite(at)?at:null};
const clean=value=>typeof value==='string'?value.trim().slice(0,240):'';

export function summarizeMbtaFoxboroAlerts(body,game,checkedAt){
  if(game?.venue?.id!=='3738'||!Number.isFinite(checkedAt)||!body||!Array.isArray(body.data)||body.data.length>100||body.errors?.length)throw Error('Bounded MBTA alert response and Gillette event required');
  const kickoff=validTime(game.kickoff),screenable=!game.timeTbd&&kickoff!==null&&kickoff>=checkedAt-9*3600000&&!/cancel/i.test(String(game.status||''));
  const start=screenable?kickoff-4*3600000:null,end=screenable?kickoff+5*3600000:null;
  const alerts=[];let invalidCount=0;
  for(const raw of body.data){
    const p=raw?.attributes,id=String(raw?.id||'');
    if(raw?.type!=='alert'||!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!p||!Array.isArray(p.active_period)||p.active_period.length>30){invalidCount++;continue}
    const periods=[];let invalidPeriod=false;
    for(const period of p.active_period){
      const from=validTime(period?.start),until=period?.end==null?null:validTime(period.end);
      if(from===null||period?.end!=null&&until===null||until!==null&&until<from){invalidPeriod=true;continue}
      periods.push({start:new Date(from).toISOString(),end:until===null?null:new Date(until).toISOString()});
    }
    if(invalidPeriod||!periods.length)invalidCount++;
    if(!periods.length)continue;
    alerts.push({id,header:clean(p.header||p.short_header)||'MBTA service alert',effect:clean(p.effect)||'UNKNOWN',lifecycle:clean(p.lifecycle)||'UNKNOWN',updatedAt:validTime(p.updated_at)?new Date(validTime(p.updated_at)).toISOString():null,periods,eventWindowOverlap:screenable&&periods.some(period=>Date.parse(period.start)<=end&&(period.end===null||(Date.parse(period.end)>=start&&Date.parse(period.end)>checkedAt))),sourceUrl:`https://api-v3.mbta.com/alerts/${encodeURIComponent(id)}`});
  }
  const incomplete=Boolean(body.links?.next)||invalidCount>0;
  return {state:incomplete?'partial':'retrieved',checkedAt,sourceId:'mbta-foxboro-alerts',stopId:mbtaFoxboroStopId,stopName:'Foxboro',stopDistanceKm:0.52,sourceUrl:mbtaFoxboroAlertsUrl,totalReturned:body.data.length,invalidCount,screenable,eventWindow:{start:start===null?null:new Date(start).toISOString(),end:end===null?null:new Date(end).toISOString()},alerts:alerts.sort((a,b)=>Number(b.eventWindowOverlap)-Number(a.eventWindowOverlap)).slice(0,30),omittedAlertCount:Math.max(0,alerts.length-30),overlapCount:screenable?alerts.filter(item=>item.eventWindowOverlap).length:0,interpretation:'MBTA alerts are filtered to Foxboro station, approximately 0.5 km from the unreviewed Gillette Stadium point. A time overlap is a transit service review cue, not verified event-train impact, venue access disruption, or a threat.'};
}
