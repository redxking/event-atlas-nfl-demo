import {fetchNwsStationObservation} from './nws_observation.js?v=20261010-1';

const HOUR=3600000;

export function directStationEligible(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff);
  return context?.monitoringMode==='near_term_monitoring'&&
    Number.isFinite(context?.lat)&&context.lat>=24&&context.lat<=50&&
    Number.isFinite(context?.lon)&&context.lon>=-125&&context.lon<=-66&&
    Number.isFinite(kickoff)&&kickoff-now<=7*24*HOUR&&now-kickoff<=24*HOUR&&
    !/cancel|postpon|delay/i.test(context?.status||'');
}

export async function checkDirectStation(context,{fetchImpl=fetch,now=Date.now()}={}){
  if(!directStationEligible(context,now))throw Error('NWS station check outside event window');
  const result=await fetchNwsStationObservation({lat:context.lat,lon:context.lon},{fetchImpl,now});
  if(result.state!=='current_station_observation'||!/^https:\/\/api\.weather\.gov\/stations\/[A-Z0-9]{3,6}\/observations\/[^/?#]+$/.test(result.sourceUrl||''))throw Error('NWS station observation unavailable or stale');
  return result;
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-nws-station');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,lat:Number(main.dataset.venueLat),lon:Number(main.dataset.venueLon),kickoff:main.dataset.kickoff,status:main.dataset.eventStatus};
    const add=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;panel.append(node);return node};
    const link=(url,label)=>{const row=add('p',''),anchor=document.createElement('a');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.textContent=label;row.append(anchor)};
    if(!directStationEligible(context))panel.closest('section')?.remove();
    else{
      let pending=false,lastCheck=0;
      async function check(){
        const now=Date.now();
        if(pending||document.visibilityState!=='visible'||now-lastCheck<270000)return;
        pending=true;lastCheck=now;panel.replaceChildren();add('p','Checking nearby NWS station observations…');
        try{
          const result=await checkDirectStation(context,{now});
          panel.replaceChildren();
          add('p',`Nearby NWS station checked ${result.checkedAt}. ${result.stationName} (${result.stationId}) is ${result.distanceKm} km from the unreviewed venue point; observation time ${result.observedAt}.`);
          add('p',`${result.description||'Description unavailable'} · temperature ${result.temperatureC==null?'unavailable':result.temperatureC+' °C'} · wind ${result.windKmh==null?'unavailable':result.windKmh+' km/h'} · relative humidity ${result.humidityPercent==null?'unavailable':result.humidityPercent+'%'}.`);
          add('p','This is a nearby station reading, not a stadium measurement or a kickoff forecast. Station distance and report age limit venue relevance; no event impact, safety conclusion, or threat is inferred. This browser check may be newer than the hourly report and is not saved in its Markdown.');
          link(result.sourceUrl,'Timestamped NWS station observation ↗');
        }catch{
          panel.replaceChildren();add('p','Direct nearby NWS station observation unavailable or stale. The published reading below may be older; no current stadium condition can be inferred.');
          link(`https://api.weather.gov/points/${context.lat},${context.lon}`,'NWS point station lookup ↗');
        }finally{pending=false}
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
