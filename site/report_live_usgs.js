import {selectUsgsForGame,usgsSourceUrl} from './usgs_nfl.js?v=usgs-integrity-1';

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

export function compareDirectUsgsToReport(state,direct,{eventId,generatedAt}){
  const prior=state?.picture?.usgsContext;
  const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
  if(!['event-atlas.published-report-state.v7','event-atlas.published-report-state.v8'].includes(state?.schema)||state.eventId!==eventId||state.generatedAt!==generatedAt||prior?.state!=='current_snapshot'||prior.sourceUrl!==usgsSourceUrl||!validTime(prior.asOf)||!Array.isArray(prior.events)||prior.events.length>3||direct?.state!=='current_snapshot'||direct.sourceUrl!==usgsSourceUrl||!validTime(direct.asOf)||!Array.isArray(direct.events)||direct.events.length>3||Date.parse(direct.asOf)<=Date.parse(prior.asOf)||Date.parse(direct.asOf)-Date.parse(prior.asOf)>12*HOUR)throw Error('Published USGS comparison unavailable');
  const valid=item=>typeof item?.sourceId==='string'&&/^[A-Za-z0-9_-]+$/.test(item.sourceId)&&item.sourceUrl===`https://earthquake.usgs.gov/earthquakes/eventpage/${item.sourceId}`&&Number.isFinite(item.magnitude)&&item.magnitude>=2.5&&Number.isFinite(item.distanceKm)&&item.distanceKm>=0&&item.distanceKm<=250&&validTime(item.occurredAt)&&(item.updatedAt===null||validTime(item.updatedAt))&&Array.isArray(item.point)&&item.point.length===2&&item.point.every(Number.isFinite);
  if(!prior.events.every(valid)||!direct.events.every(valid)||new Set(prior.events.map(item=>item.sourceId)).size!==prior.events.length||new Set(direct.events.map(item=>item.sourceId)).size!==direct.events.length)throw Error('Invalid USGS comparison record');
  const before=new Map(prior.events.map(item=>[item.sourceId,item])),after=new Map(direct.events.map(item=>[item.sourceId,item])),changes=[];
  for(const item of direct.events){
    const old=before.get(item.sourceId);
    if(!old){changes.push({kind:'newly_displayed',record:item,previous:null,changedFields:[]});continue}
    if(!validTime(item.updatedAt)||validTime(old.updatedAt)&&Date.parse(item.updatedAt)<=Date.parse(old.updatedAt))continue;
    const changedFields=['title','magnitude','point'].filter(field=>field==='point'?item.point[0]!==old.point[0]||item.point[1]!==old.point[1]:item[field]!==old[field]);
    if(changedFields.length)changes.push({kind:'publisher_revision',record:item,previous:old,changedFields});
  }
  for(const item of prior.events)if(!after.has(item.sourceId))changes.push({kind:'no_longer_displayed',record:item,previous:item,changedFields:[]});
  return {publishedAt:prior.asOf,directAt:direct.asOf,changes};
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
          try{
            const path=main.dataset.reportPath;
            if(!/^reports\/nfl-\d+\.html$/.test(path))throw Error('Invalid report path');
            const baselineUrl=new URL(path.slice('reports/'.length).replace(/\.html$/,'.state.json'),location.href);
            const baselineResponse=await fetch(baselineUrl,{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
            if(!baselineResponse.ok||Number(baselineResponse.headers.get('content-length'))>300000)throw Error('Published state unavailable');
            const baselineBody=await baselineResponse.text();
            if(baselineBody.length>300000)throw Error('Published state oversized');
            const comparison=compareDirectUsgsToReport(JSON.parse(baselineBody),result,{eventId:main.dataset.gameId,generatedAt:main.dataset.generatedAt});
            add('p',`Compared with this report’s published USGS sample from ${comparison.publishedAt}. These are differences in a capped nearby display, not independent confirmations of shaking or impact.`);
            if(!comparison.changes.length)add('p','No material difference in the displayed three-record sample. This does not establish that all source records are unchanged or that conditions are safe.');
            for(const change of comparison.changes){
              const item=change.record;
              let description;
              if(change.kind==='newly_displayed')description=`Newly displayed in the direct three-record sample: ${item.title}; occurred ${item.occurredAt}. This does not by itself establish a new event or local impact.`;
              else if(change.kind==='no_longer_displayed')description=`No longer displayed in the direct three-record sample: ${item.title}. This does not establish resolution or absence of effects.`;
              else{
                const old=change.previous,fields=change.changedFields.map(field=>field==='title'?`title ${old.title} → ${item.title}`:field==='magnitude'?`reported magnitude ${old.magnitude} → ${item.magnitude}`:`source point and venue distance ${old.distanceKm} → ${item.distanceKm} km`).join('; ');
                description=`USGS fields revised since the report sample: ${item.title}; ${fields}. Source updated ${old.updatedAt||'not supplied'} → ${item.updatedAt}.`;
              }
              const row=add('p',description+' ');link(item.sourceUrl,'USGS event ↗',row);
            }
          }catch{add('p','Comparison with this page’s published USGS snapshot is unavailable; use the dated direct records above and verify source changes with USGS.');}
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
