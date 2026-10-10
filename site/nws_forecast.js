const HOUR=3600000;
const hourlyUrl=/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3,4}\/\d+,\d+\/forecast\/hourly$/;
const unavailable=(state='unavailable or stale')=>({state,sourceUrl:null,checkedAt:null,period:null});
function currentPeriod(game,forecast,now,target,state){
  const checkedAt=forecast?.checkedAt,url=forecast?.sourceUrl;
  if(forecast?.state!=='ok'||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>30*60000||forecast.kickoff!==game.kickoff||!hourlyUrl.test(url||''))return unavailable();
  const period=forecast.period,start=Date.parse(period?.startTime),end=Date.parse(period?.endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||!(start<=target&&target<end)||typeof period?.shortForecast!=='string'||!period.shortForecast.trim())return {state:'unavailable or stale',sourceUrl:url,checkedAt:new Date(checkedAt).toISOString(),period:null};
  const temperature=Number.isFinite(period.temperature)?period.temperature:null;
  const precipitation=period.probabilityOfPrecipitation?.value;
  return {state,sourceUrl:url,checkedAt:new Date(checkedAt).toISOString(),period:{startTime:period.startTime,endTime:period.endTime,shortForecast:period.shortForecast.slice(0,180),temperature,temperatureUnit:['F','C'].includes(period.temperatureUnit)?period.temperatureUnit:null,windSpeed:typeof period.windSpeed==='string'?period.windSpeed.slice(0,60):null,windDirection:typeof period.windDirection==='string'?period.windDirection.slice(0,20):null,precipitationPercent:Number.isFinite(precipitation)&&precipitation>=0&&precipitation<=100?precipitation:null}};
}

export function selectKickoffForecast(game,forecast,now=Date.now()){
  const kickoff=Date.parse(game?.kickoff);
  if(game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now||kickoff-now>168*HOUR||/cancel/i.test(game?.status||''))return unavailable('outside forecast window');
  return currentPeriod(game,forecast,now,kickoff,'current forecast');
}

export function selectEventHourForecast(game,forecast,now=Date.now()){
  const kickoff=Date.parse(game?.kickoff);
  if(game?.status!=='in progress in source'||game.timeTbd||!Number.isFinite(kickoff)||now<kickoff||now>kickoff+9*HOUR)return unavailable('outside active event window');
  return currentPeriod(game,forecast,now,now,'current event-hour forecast');
}
