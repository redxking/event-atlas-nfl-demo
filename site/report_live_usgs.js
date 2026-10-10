import {selectUsgsForGame,usgsSourceUrl} from './usgs_nfl.js?v=20261010-1';

const HOUR=3600000;

export function directUsgsEligible(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff);
  return context?.monitoringMode==='near_term_monitoring'&&
    Number.isFinite(context?.lat)&&context.lat>=24&&context.lat<=50&&
    Number.isFinite(context?.lon)&&context.lon>=-125&&context.lon<=-66&&
    Number.isFinite(kickoff)&&kickoff-now<=7*24*HOUR&&now-kickoff<=24*HOUR&&
    !/cancel|postpon|delay/i.test(context?.status||'');
}

export function summarizeDirectUsgs(context,feed,checkedAt,now=checkedAt){
  if(!directUsgsEligible(context,now))throw Error('USGS direct check outside event window');
  const game={venue:{lat:context.lat,lon:context.lon}};
  const result=selectUsgsForGame(game,{at:checkedAt,quakes:feed},now);
  if(result.state!=='current_snapshot')throw Error('USGS feed unavailable or stale');
  return result;
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-usgs');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,lat:Number(main.dataset.venueLat),lon:Number(main.dataset.venueLon),kickoff:main.dataset.kickoff,status:main.dataset.eventStatus};
    const add=(tag,value,parent=panel)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node};
    const link=(url,label,parent=panel)=>{const node=document.createElement('a');node.href=url;node.target='_blank';node.rel='noopener noreferrer';node.textContent=label;parent.append(node)};
    if(!directUsgsEligible(context))panel.closest('section')?.remove();
    else{
      let pending=false,lastCheck=0;
      async function check(){
        const now=Date.now();
        if(pending||document.visibilityState!=='visible'||now-lastCheck<270000)return;
        if(!directUsgsEligible(context,now)){panel.replaceChildren();add('p','Outside the direct earthquake-check window; use the dated report below.');return}
        pending=true;lastCheck=now;panel.replaceChildren();add('p','Checking the USGS magnitude 2.5+ weekly feed…');
        try{
          const response=await fetch(usgsSourceUrl,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'application/geo+json, application/json'}});
          if(!response.ok||Number(response.headers.get('content-length'))>2500000)throw Error(`HTTP ${response.status}`);
          const raw=await response.text();
          if(raw.length>2500000)throw Error('Oversized USGS response');
          const result=summarizeDirectUsgs(context,JSON.parse(raw),Date.now());
          panel.replaceChildren();
          add('p',`USGS feed checked ${result.asOf}; publisher generated ${result.publisherAt||'not supplied'}. ${result.events.length} magnitude 2.5+ record${result.events.length===1?'':'s'} within 250 km of the unreviewed venue point in this bounded weekly sample.`);
          for(const item of result.events){
            const row=add('p',`${item.title} · magnitude ${item.magnitude} · ${item.distanceKm} km · occurred ${item.occurredAt} · updated ${item.updatedAt||'not supplied'}. `);
            link(item.sourceUrl,'USGS event ↗',row);
          }
          add('p','The panel shows at most three nearby records. A nearby earthquake point does not establish shaking, damage, route impact, stadium impact or a threat. No nearby record is not an all-clear. This browser check may be newer than the hourly report and is not saved in its Markdown.');
        }catch{
          panel.replaceChildren();add('p','Direct USGS check unavailable. The dated report below may be older; verify the current feed with USGS.');
        }finally{
          const row=add('p','');link(usgsSourceUrl,'USGS magnitude 2.5+ weekly feed ↗',row);pending=false;
        }
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
