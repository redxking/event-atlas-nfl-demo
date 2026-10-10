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

export function compareDirectNifcToReport(state,direct,{eventId,generatedAt}){
  const prior=state?.picture?.wildfireContext;
  if(!['event-atlas.published-report-state.v7','event-atlas.published-report-state.v8'].includes(state?.schema)||state.eventId!==eventId||state.generatedAt!==generatedAt||prior?.state!=='current_snapshot'||prior.sourceUrl!==nifcSource||!Number.isFinite(Date.parse(prior.asOf))||!Array.isArray(prior.events)||prior.events.length>5||direct?.state!=='current_snapshot'||!Number.isFinite(Date.parse(direct.asOf))||Date.parse(direct.asOf)<=Date.parse(prior.asOf)||Date.parse(direct.asOf)-Date.parse(prior.asOf)>12*HOUR||!Array.isArray(direct.events)||direct.events.length>5)throw Error('Published NIFC comparison unavailable');
  const valid=item=>Number.isInteger(item?.id)&&item.id>0&&item.sourceUrl===`${nifcLayer}/${item.id}`&&Number.isFinite(item.distanceKm)&&item.distanceKm>=0&&item.distanceKm<=150&&Number.isFinite(Date.parse(item.updatedAt));
  if(!prior.events.every(valid)||!direct.events.every(valid)||new Set(prior.events.map(item=>item.id)).size!==prior.events.length||new Set(direct.events.map(item=>item.id)).size!==direct.events.length)throw Error('Invalid NIFC comparison record');
  const before=new Map(prior.events.map(item=>[item.id,item])),after=new Map(direct.events.map(item=>[item.id,item])),changes=[];
  for(const item of direct.events){
    const old=before.get(item.id);
    if(!old){changes.push({kind:'newly_displayed',record:item,previous:null,changedFields:[]});continue}
    if(Date.parse(item.updatedAt)<=Date.parse(old.updatedAt))continue;
    const changedFields=['name','acres','containedPercent','point'].filter(field=>field==='point'?item.lat!==old.lat||item.lon!==old.lon:item[field]!==old[field]);
    if(changedFields.length)changes.push({kind:'publisher_revision',record:item,previous:old,changedFields});
  }
  for(const item of prior.events)if(!after.has(item.id))changes.push({kind:'no_longer_displayed',record:item,previous:item,changedFields:[]});
  return {publishedAt:prior.asOf,directAt:direct.asOf,changes};
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
          try{
            const path=main.dataset.reportPath;
            if(!/^reports\/nfl-\d+\.html$/.test(path))throw Error('Invalid report path');
            const baselineUrl=new URL(path.slice('reports/'.length).replace(/\.html$/,'.state.json'),location.href);
            const baselineResponse=await fetch(baselineUrl,{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
            if(!baselineResponse.ok||Number(baselineResponse.headers.get('content-length'))>300000)throw Error('Published state unavailable');
            const baselineBody=await baselineResponse.text();
            if(baselineBody.length>300000)throw Error('Published state oversized');
            const comparison=compareDirectNifcToReport(JSON.parse(baselineBody),result,{eventId:main.dataset.gameId,generatedAt:main.dataset.generatedAt});
            add('p',`Compared with this report’s published NIFC sample from ${comparison.publishedAt}. These are differences in a capped display, not independent incident confirmations.`);
            if(!comparison.changes.length)add('p','No material difference in the displayed five-record sample. This does not prove the publisher made no other changes or that conditions are safe.');
            for(const change of comparison.changes){
              const item=change.record;
              let description;
              if(change.kind==='newly_displayed')description=`Newly displayed in the direct five-record sample: ${item.name}; source updated ${item.updatedAt}. This does not establish a new incident.`;
              else if(change.kind==='no_longer_displayed')description=`No longer displayed in the direct five-record sample: ${item.name}. This does not establish containment or resolution.`;
              else{
                const old=change.previous,fields=change.changedFields.map(field=>field==='name'?`name ${old.name} → ${item.name}`:field==='acres'?`reported acres ${old.acres??'unreported'} → ${item.acres??'unreported'}`:field==='containedPercent'?`reported containment ${old.containedPercent==null?'unreported':old.containedPercent+'%'} → ${item.containedPercent==null?'unreported':item.containedPercent+'%'}`:`source point and venue distance ${old.distanceKm} → ${item.distanceKm} km`).join('; ');
                description=`Publisher fields revised since the report sample: ${item.name}; ${fields}. Source updated ${old.updatedAt} → ${item.updatedAt}.`;
              }
              const row=add('p',description+' ');link(item.sourceUrl,'NIFC record ↗',row);
            }
          }catch{add('p','Comparison with this page’s published NIFC snapshot is unavailable; use the dated direct records above and verify source changes with NIFC.');}
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
