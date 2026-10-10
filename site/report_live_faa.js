const FAA_LAYER='https://services1.arcgis.com/n4Ot9Qz0t5espY4s/arcgis/rest/services/SEAMS_Production_View/FeatureServer/0';
const FAA_ITEM='https://faasysops.maps.arcgis.com/home/item.html?id=9f246af52c4049b99b50a2b97e2e5b2c';
const normalize=value=>String(value||'').toLowerCase().replace(/\s+@\s+/g,' at ').replace(/[^a-z0-9]+/g,' ').trim();
const validUuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value||'');

export function selectFaaReportHint(snapshot,context){
  const record=snapshot?.byGame?.[context?.gameId];
  const kickoff=Date.parse(context?.kickoff),start=Date.parse(record?.startAt);
  if(snapshot?.sourceUrl!==FAA_LAYER||!record||!Number.isInteger(record.objectId)||record.objectId<1||!validUuid(record.sourceGameId)||!context?.home||!context?.away||!record.venueName||normalize(record.eventName)!==normalize(`${context.away} at ${context.home}`)||!Number.isFinite(kickoff)||!Number.isFinite(start)||Math.abs(start-kickoff+3600000)>60000)return null;
  return {objectId:record.objectId,sourceGameId:record.sourceGameId,eventName:record.eventName,venueName:record.venueName};
}

export function faaRecordQuery(hint){
  if(!Number.isInteger(hint?.objectId)||hint.objectId<1)return null;
  const url=new URL(`${FAA_LAYER}/query`);
  url.search=new URLSearchParams({where:`OBJECTID=${hint.objectId}`,outFields:'OBJECTID,GAME_DETAIL_ID,EVENT_NAME,VENUE,GAME_DATE,END_DATE,STATUS,IS_ACTIVE,updatedAt',returnGeometry:'false',f:'json'});
  return url.href;
}

export function summarizeDirectFaa(data,hint,context,checkedAt=Date.now()){
  if(!Array.isArray(data?.features)||data.features.length!==1||data.error)return {state:'unavailable'};
  const a=data.features[0]?.attributes||{};
  const start=a.GAME_DATE,end=a.END_DATE,updated=a.updatedAt,kickoff=Date.parse(context?.kickoff);
  if(a.OBJECTID!==hint?.objectId||a.GAME_DETAIL_ID!==hint.sourceGameId||normalize(a.EVENT_NAME)!==normalize(`${context?.away} at ${context?.home}`)||normalize(a.VENUE)!==normalize(hint.venueName)||!Number.isFinite(kickoff)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||Math.abs(start-kickoff+3600000)>60000||!Number.isFinite(updated)||updated<Date.parse('2020-01-01T00:00:00Z')||updated>checkedAt+3600000||typeof a.STATUS!=='string'||a.STATUS.length>80||![0,1].includes(a.IS_ACTIVE))return {state:'mismatch'};
  return {state:'checked',checkedAt:new Date(checkedAt).toISOString(),sourceUpdatedAt:new Date(updated).toISOString(),startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),status:a.STATUS,isActive:a.IS_ACTIVE===1,sourceUrl:faaRecordQuery(hint),sourceItemUrl:FAA_ITEM};
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-game-id][data-monitoring-mode]');
  const target=document.querySelector('#direct-faa');
  if(main&&target){
    const context={gameId:main.dataset.gameId,home:main.dataset.home,away:main.dataset.away,kickoff:main.dataset.kickoff};
    const p=text=>{const node=document.createElement('p');node.textContent=text;target.append(node)};
    const link=(url,label)=>{const node=document.createElement('a');node.href=url;node.target='_blank';node.rel='noopener noreferrer';node.textContent=label;return node};
    let pending=false;
    async function check(){
      if(pending||document.visibilityState!=='visible')return;
      target.replaceChildren();
      if(main.dataset.monitoringMode!=='near_term_monitoring'){p('Direct FAA event-record checks start when this game enters the fourteen-day monitoring window.');return}
      pending=true;
      try{
        const response=await fetch(new URL('seams.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
        if(!response.ok)throw Error('FAA identity snapshot unavailable');
        const raw=await response.text();if(raw.length>1_000_000)throw Error('FAA identity snapshot too large');
        const hint=selectFaaReportHint(JSON.parse(raw),context);
        if(!hint){p('No source-matched FAA event record is available for direct checking. Confirm current NOTAMs with FAA.');target.append(link('https://tfr.faa.gov/tfr3/','FAA TFR review'));return}
        const url=faaRecordQuery(hint);
        const direct=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
        if(!direct.ok)throw Error('FAA record unavailable');
        const body=await direct.text();if(body.length>100000)throw Error('FAA record too large');
        const result=summarizeDirectFaa(JSON.parse(body),hint,context);
        if(result.state!=='checked'){
          p('FAA record was absent or no longer matched the exact game. Current airspace state is unavailable; verify directly with FAA.');
          target.append(link(url,'FAA record query'),document.createTextNode(' · '),link('https://tfr.faa.gov/tfr3/','FAA TFR review'));
          return;
        }
        p(`FAA SEAMS checked ${result.checkedAt}; source record updated ${result.sourceUpdatedAt}. Publisher status: ${result.status}; source active flag: ${result.isActive?'yes':'no'}. Published window ${result.startAt} to ${result.endAt}.`);
        p('This browser check may be newer than the hourly report and is not saved in its Markdown. The informational FAA record is not a current NOTAM determination, drone detection, ground security perimeter, observed aircraft, or threat finding. A source active flag of no is not flight authorization.');
        target.append(link(result.sourceUrl,'FAA SEAMS record'),document.createTextNode(' · '),link(result.sourceItemUrl,'FAA dataset'),document.createTextNode(' · '),link('https://tfr.faa.gov/tfr3/','Current FAA TFR review'));
      }catch{target.replaceChildren();p('Direct FAA record check failed. The hourly snapshot may be stale; confirm current NOTAMs with FAA.');target.append(link('https://tfr.faa.gov/tfr3/','FAA TFR review'))}finally{pending=false}
    }
    check();setInterval(check,300000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
  }
}
