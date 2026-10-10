import {selectWeatherContext} from './weather_relevance.js';

const HOUR=3600000;
const allowedAlertUrl=value=>{
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='api.weather.gov'&&/^\/alerts\/[A-Za-z0-9._~:%+-]+$/.test(url.pathname)?url.href:null}catch{return null}
};

export function summarizeDirectNws(game,data,checkedAt,now=Date.now()){
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>100)throw Error('Invalid NWS alert collection');
  const selected=selectWeatherContext(game,data.features,checkedAt,now);
  if(selected.state!=='screened')throw Error('NWS result cannot be time screened');
  const alerts=selected.alerts.map(({feature,candidate})=>{
    const p=feature.properties||{};
    const url=allowedAlertUrl(p['@id']||feature.id);
    return {candidate,event:String(p.event||'NWS alert').slice(0,120),severity:String(p.severity||'unknown').slice(0,30),urgency:String(p.urgency||'unknown').slice(0,30),effective:p.effective||null,ends:p.ends||p.expires||null,url};
  });
  return {checkedAt:new Date(checkedAt).toISOString(),state:'checked',candidateCount:selected.candidateCount,returnedCount:data.features.length,alerts};
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-nws');
  if(main&&panel){
    const lat=Number(main.dataset.venueLat),lon=Number(main.dataset.venueLon);
    const kickoff=Date.parse(main.dataset.kickoff);
    const game={kickoff:main.dataset.kickoff,timeTbd:false,status:main.dataset.eventStatus};
    const sourceUrl=Number.isFinite(lat)&&lat>=24&&lat<=50&&Number.isFinite(lon)&&lon>=-125&&lon<=-66?`https://api.weather.gov/alerts/active?point=${lat},${lon}`:null;
    const eligible=main.dataset.monitoringMode==='near_term_monitoring'&&sourceUrl&&Number.isFinite(kickoff)&&kickoff+5*HOUR>=Date.now()&&!/cancel/i.test(game.status||'');
    const add=(tag,value,parent=panel)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node};
    const link=(url,label,parent=panel)=>{const node=document.createElement('a');node.href=url;node.target='_blank';node.rel='noopener noreferrer';node.textContent=label;parent.append(node)};
    if(!eligible){panel.replaceChildren();add('p','Direct NWS point check is outside this report’s current event window or lacks a validated venue point. Use the dated published source status below.');}
    else{
      let pending=false,lastCheck=0;
      async function check(){
        if(pending||document.visibilityState!=='visible'||Date.now()-lastCheck<270000)return;
        pending=true;lastCheck=Date.now();panel.replaceChildren();add('p','Checking the NWS active-alert point feed…');
        try{
          const response=await fetch(sourceUrl,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'application/geo+json, application/json'}});
          if(!response.ok)throw Error(`HTTP ${response.status}`);
          const raw=await response.text();
          if(raw.length>500000)throw Error('Oversized NWS response');
          const result=summarizeDirectNws(game,JSON.parse(raw),Date.now());
          panel.replaceChildren();add('p',`NWS point check completed ${result.checkedAt}. ${result.candidateCount} severe or extreme alert review candidate${result.candidateCount===1?'':'s'} overlap the illustrative game window; ${result.returnedCount} active point alert${result.returnedCount===1?'':'s'} returned.`);
          const list=document.createElement('div');panel.append(list);
          for(const item of result.alerts){
            const row=add('p',`${item.candidate?'REVIEW CANDIDATE · ':''}${item.event} · ${item.severity} severity · ${item.urgency} urgency · effective ${item.effective||'not supplied'} to ${item.ends||'not supplied'}. `,list);
            if(item.url)link(item.url,'NWS alert ↗',row);
          }
          if(result.returnedCount>result.alerts.length)add('p',`Showing ${result.alerts.length} of ${result.returnedCount} returned alerts; inspect the publisher feed for the full set.`);
          add('p','This direct check is newer than the hourly report and is not saved in its Markdown. A point alert or time overlap does not establish stadium impact or a threat; zero candidates is not an all-clear.');
          const p=add('p','');link(sourceUrl,'NWS active-alert point feed ↗',p);
        }catch{
          panel.replaceChildren();add('p','Direct NWS point check unavailable. The hourly report below may be older; verify current conditions with the publisher.');
          const p=add('p','');link(sourceUrl,'NWS active-alert point feed ↗',p);
        }finally{pending=false}
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
