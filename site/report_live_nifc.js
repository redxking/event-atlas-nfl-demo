import {buildNifcSnapshot,selectNifcForGame,nifcLayer,nifcSource} from './nifc_wildfire.js?v=20261010-1';

const HOUR=3600000,DAY=24*HOUR;

export function directNifcEligible(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff);
  return context?.monitoringMode==='near_term_monitoring'&&
    Number.isFinite(context?.lat)&&context.lat>=24&&context.lat<=50&&
    Number.isFinite(context?.lon)&&context.lon>=-125&&context.lon<=-66&&
    Number.isFinite(kickoff)&&kickoff-now<=7*DAY&&now-kickoff<=DAY&&
    !/cancel|postpon|delay/i.test(context?.status||'');
}

export function nifcDirectQueryUrl(context,now=Date.now()){
  if(!directNifcEligible(context,now))throw Error('NIFC direct check outside event window');
  const latRadius=150/110.5+0.05;
  const lonRadius=150/(111*Math.cos((Math.abs(context.lat)+latRadius)*Math.PI/180))+0.05;
  const url=new URL(`${nifcLayer}/query`);
  for(const [key,value] of Object.entries({
    where:"IncidentTypeCategory = 'WF'",
    geometry:[context.lon-lonRadius,context.lat-latRadius,context.lon+lonRadius,context.lat+latRadius].join(','),
    geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,IncidentName,IncidentTypeCategory,IncidentSize,FireDiscoveryDateTime,ModifiedOnDateTime_dt,FireOutDateTime,PercentContained',
    returnGeometry:'true',outSR:'4326',resultRecordCount:'1000',f:'json'
  }))url.searchParams.set(key,value);
  return url.href;
}

export function summarizeDirectNifc(context,raw,checkedAt,now=checkedAt){
  if(!directNifcEligible(context,now)||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>5*60000)throw Error('NIFC direct check unavailable or stale');
  if(!Array.isArray(raw?.features)||raw.features.length>=1000||raw.exceededTransferLimit||raw.error)throw Error('NIFC direct response incomplete');
  const game={venue:{id:'direct-report-venue',lat:context.lat,lon:context.lon}};
  const snapshot=buildNifcSnapshot(raw,[game],checkedAt);
  const result=selectNifcForGame(game,snapshot,now);
  if(result.state!=='current_snapshot')throw Error('NIFC direct response unavailable');
  return {...result,queriedFeatureCount:raw.features.length};
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-nifc');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,lat:Number(main.dataset.venueLat),lon:Number(main.dataset.venueLon),kickoff:main.dataset.kickoff,status:main.dataset.eventStatus};
    const add=(tag,value,parent=panel)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node};
    const link=(url,label,parent=panel)=>{const node=document.createElement('a');node.href=url;node.target='_blank';node.rel='noopener noreferrer';node.textContent=label;parent.append(node)};
    if(!directNifcEligible(context))panel.closest('section')?.remove();
    else{
      let pending=false,lastCheck=0;
      async function check(){
        const now=Date.now();
        if(pending||document.visibilityState!=='visible'||now-lastCheck<270000)return;
        if(!directNifcEligible(context,now)){panel.replaceChildren();add('p','Outside the direct wildfire-check window; use the dated report below.');return}
        pending=true;lastCheck=now;panel.replaceChildren();add('p','Checking the NIFC wildfire incident-point service…');
        try{
          const url=nifcDirectQueryUrl(context,now);
          const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
          if(!response.ok||new URL(response.url).hostname!=='services3.arcgis.com'||Number(response.headers.get('content-length'))>1500000)throw Error('NIFC query unavailable');
          const body=await response.text();
          if(body.length>1500000)throw Error('NIFC query oversized');
          const result=summarizeDirectNifc(context,JSON.parse(body),Date.now());
          panel.replaceChildren();
          add('p',`NIFC service checked ${result.asOf}. Displaying ${result.events.length} recent wildfire incident point${result.events.length===1?'':'s'} within 150 km of the unreviewed venue point from a complete location-bounded query; the display is capped at five.`);
          for(const item of result.events){
            const row=add('p',`${item.name} · ${item.distanceKm} km · source updated ${item.updatedAt} · reported acres ${item.acres??'unreported'} · reported containment ${item.containedPercent==null?'unreported':item.containedPercent+'%'}. `);
            link(item.sourceUrl,'NIFC record ↗',row);
          }
          add('p','A point is not a fire perimeter, smoke observation, route disruption, stadium impact, or threat finding. No nearby point is not an all-clear. This browser check may be newer than the hourly report and is not saved in its Markdown.');
        }catch{
          panel.replaceChildren();add('p','Direct NIFC check unavailable or incomplete. The dated report below may be older; verify the current incident service.');
        }finally{
          const row=add('p','');link(nifcSource,'NIFC current incident locations ↗',row);pending=false;
        }
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
