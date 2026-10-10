import {parseTennesseeRoadEvents,tennesseeRoadLayer,tennesseeRoadQuery} from './tennessee_road_events.js';

const HOUR=3600000;
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};

export function directTennesseeRoadEligible(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff);
  return context?.monitoringMode==='near_term_monitoring'&&context?.venueId==='3810'&&
    Number.isFinite(context?.lat)&&context.lat>=35.9&&context.lat<=36.35&&
    Number.isFinite(context?.lon)&&context.lon>=-87.05&&context.lon<=-86.6&&
    Number.isFinite(kickoff)&&kickoff-now<=7*24*HOUR&&now-kickoff<=5*HOUR&&
    !/cancel|postpon|delay/i.test(context?.status||'');
}

export function summarizeDirectTennesseeRoad(context,data,checkedAt=Date.now()){
  if(!directTennesseeRoadEligible(context,checkedAt)||data?.error||data?.exceededTransferLimit||!Array.isArray(data?.features)||data.features.length>=1000)throw Error('TDOT result unavailable or incomplete');
  const records=parseTennesseeRoadEvents(data.features,checkedAt,checkedAt+90*24*HOUR,tennesseeRoadLayer)
    .map(item=>({...item,distanceKm:Math.round(distance(context.lat,context.lon,item.lat,item.lon)*10)/10}))
    .filter(item=>item.distanceKm<=10)
    .sort((a,b)=>a.distanceKm-b.distanceKm||a.id.localeCompare(b.id));
  return {checkedAt:new Date(checkedAt).toISOString(),returnedCount:data.features.length,nearbyCount:records.length,records:records.slice(0,8),sourceUrl:tennesseeRoadLayer};
}

export async function checkDirectTennesseeRoad(context,now=Date.now()){
  if(!directTennesseeRoadEligible(context,now))throw Error('Outside direct TDOT window');
  const url=tennesseeRoadQuery(now);
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
  if(!response.ok||new URL(response.url).origin!==new URL(tennesseeRoadLayer).origin)throw Error('TDOT response unavailable');
  const body=await response.text();
  if(body.length>2000000)throw Error('TDOT response exceeds bound');
  return summarizeDirectTennesseeRoad(context,JSON.parse(body),Date.now());
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-tennessee-road');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,venueId:main.dataset.venueId,lat:Number(main.dataset.venueLat),lon:Number(main.dataset.venueLon),kickoff:main.dataset.kickoff,status:main.dataset.eventStatus};
    const add=(tag,value,parent=panel)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node};
    const link=(url,label,parent=panel)=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;parent.append(a)};
    if(!directTennesseeRoadEligible(context))panel.closest('section')?.remove();
    else{
      let pending=false,lastCheck=0;
      async function check(){
        const now=Date.now();
        if(pending||document.visibilityState!=='visible'||now-lastCheck<270000)return;
        if(!directTennesseeRoadEligible(context,now)){panel.replaceChildren();add('p','Outside the direct TDOT road check window.');return}
        pending=true;lastCheck=now;panel.replaceChildren();add('p','Checking current TDOT SmartWay road events…');
        try{
          const result=await checkDirectTennesseeRoad(context);
          panel.replaceChildren();add('p',`TDOT checked ${result.checkedAt}. ${result.nearbyCount} qualifying source-listed road event${result.nearbyCount===1?'':'s'} within 10 km of the unreviewed Nissan Stadium point; ${result.returnedCount} records returned by the bounded Nashville query.${result.nearbyCount>8?' Showing the eight nearest.':''}`);
          for(const item of result.records){const row=add('p',`${item.kind} · ${item.name} · ${item.distanceKm} km. ${item.detail||'No description supplied.'} `);link(item.sourceUrl,'TDOT source ↗',row)}
          add('p','TDOT numeric event times are not verified as UTC and are not matched to kickoff. Proximity and source listing do not establish an active route disruption, stadium access impact, or threat. Zero nearby rows is not an all-clear. This browser check is not saved in the hourly Markdown.');
          const row=add('p','');link(result.sourceUrl,'TDOT SmartWay event layer ↗',row);
        }catch{
          panel.replaceChildren();add('p','Direct TDOT road check unavailable or incomplete. The hourly report below may be older; verify current conditions with Tennessee DOT.');
          const row=add('p','');link(tennesseeRoadLayer,'TDOT SmartWay event layer ↗',row);
        }finally{pending=false}
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
