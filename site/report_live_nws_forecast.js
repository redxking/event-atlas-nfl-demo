import {selectKickoffForecast,selectEventHourForecast} from './nws_forecast.js';

const HOUR=3600000;
const hourlyUrl=/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3,4}\/\d+,\d+\/forecast\/hourly$/;
const validPoint=(lat,lon)=>Number.isFinite(lat)&&lat>=24&&lat<=50&&Number.isFinite(lon)&&lon>=-125&&lon<=-66;

export function directForecastMode(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff),active=context?.status==='in progress in source';
  if(context?.monitoringMode!=='near_term_monitoring'||!validPoint(context?.lat,context?.lon)||!Number.isFinite(kickoff)||/cancel|postpon|delay/i.test(context?.status||''))return null;
  if(active)return now>=kickoff&&now<=kickoff+9*HOUR?'event_hour':null;
  return kickoff>=now&&kickoff-now<=7*24*HOUR?'kickoff':null;
}

export function summarizeDirectForecast(context,point,hourly,checkedAt=Date.now()){
  const mode=directForecastMode(context,checkedAt),url=point?.properties?.forecastHourly;
  if(!mode||!hourlyUrl.test(url||'')||!Array.isArray(hourly?.properties?.periods)||hourly.properties.periods.length>300)throw Error('NWS hourly forecast unavailable');
  const generated=Date.parse(hourly.properties.generatedAt);
  if(!Number.isFinite(generated)||generated>checkedAt+HOUR||checkedAt-generated>12*HOUR)throw Error('NWS forecast publication time unavailable or stale');
  const target=mode==='event_hour'?checkedAt:Date.parse(context.kickoff);
  const period=hourly.properties.periods.find(item=>Date.parse(item.startTime)<=target&&target<Date.parse(item.endTime));
  const game={kickoff:context.kickoff,timeTbd:false,status:context.status};
  const forecast={state:'ok',checkedAt,kickoff:context.kickoff,sourceUrl:url,period};
  const selected=mode==='event_hour'?selectEventHourForecast(game,forecast,checkedAt):selectKickoffForecast(game,forecast,checkedAt);
  if(!['current forecast','current event-hour forecast'].includes(selected.state))throw Error('No valid NWS period covers the event hour');
  return {mode,checkedAt:selected.checkedAt,publisherGeneratedAt:new Date(generated).toISOString(),sourceUrl:url,period:selected.period};
}

async function boundedNwsJson(url,limit){
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'application/geo+json, application/json'}});
  if(!response.ok||new URL(response.url).origin!=='https://api.weather.gov')throw Error('NWS response unavailable');
  const body=await response.text();
  if(body.length>limit)throw Error('NWS response exceeds bound');
  return JSON.parse(body);
}

export async function checkDirectForecast(context,now=Date.now()){
  if(!directForecastMode(context,now))throw Error('Outside direct forecast window');
  const point=await boundedNwsJson(`https://api.weather.gov/points/${context.lat},${context.lon}`,300000);
  const url=point?.properties?.forecastHourly;
  if(!hourlyUrl.test(url||''))throw Error('Unexpected NWS hourly forecast link');
  const hourly=await boundedNwsJson(url,1000000);
  return summarizeDirectForecast(context,point,hourly,Date.now());
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-nws-forecast');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,lat:Number(main.dataset.venueLat),lon:Number(main.dataset.venueLon),kickoff:main.dataset.kickoff,status:main.dataset.eventStatus};
    const add=(tag,value,parent=panel)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node};
    const source=validPoint(context.lat,context.lon)?`https://api.weather.gov/points/${context.lat},${context.lon}`:null;
    const link=(url,label)=>{const p=add('p','');const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;p.append(a)};
    if(!directForecastMode(context)){panel.closest('section')?.remove()}
    else{
      let pending=false,lastCheck=0;
      async function check(){
        if(pending||document.visibilityState!=='visible'||Date.now()-lastCheck<270000)return;
        pending=true;lastCheck=Date.now();panel.replaceChildren();add('p','Checking the NWS hourly forecast for this event…');
        try{
          const result=await checkDirectForecast(context),period=result.period;
          panel.replaceChildren();add('p',`${result.mode==='event_hour'?'Current event-hour':'Listed kickoff-hour'} forecast checked ${result.checkedAt}; NWS forecast generated ${result.publisherGeneratedAt}. Forecast period ${period.startTime} to ${period.endTime}.`);
          add('p',`${period.shortForecast} · ${period.temperature??'temperature unavailable'}°${period.temperatureUnit||''} · wind ${period.windSpeed||'unavailable'} ${period.windDirection||''} · precipitation ${period.precipitationPercent??'unavailable'}%.`);
          add('p','This is a grid forecast, not a stadium observation, hazard alert, event impact, or threat finding. This direct check may be newer than the hourly report and is not saved in its Markdown. Confirm current conditions with NWS.');
          link(result.sourceUrl,'NWS hourly forecast ↗');
        }catch{
          panel.replaceChildren();add('p','Direct NWS hourly forecast unavailable. The published forecast below may be older; verify the latest forecast with NWS.');
          if(source)link(source,'NWS point forecast lookup ↗');
        }finally{pending=false}
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
