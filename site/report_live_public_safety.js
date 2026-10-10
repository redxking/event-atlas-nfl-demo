import {seattleFireAggregateQuery,seattleFireMetadataUrl,seattleFireDataset,summarizeSeattleFireAggregate} from './seattle_fire_aggregate.js';
import {nashvillePoliceLayer,nashvillePolicePage,validateNashvillePoliceCount} from './nashville_police_aggregate.js';

const HOUR=3600000;
export function directPublicSafetyKind(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff);
  if(context?.monitoringMode!=='near_term_monitoring'||!Number.isFinite(kickoff)||kickoff+5*HOUR<now||/cancel/i.test(context?.status||''))return null;
  return context?.venueId==='3673'?'seattle_fire':context?.venueId==='3810'?'nashville_police':null;
}

async function boundedJson(url,limit){
  const expected=new URL(url).origin;
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
  if(!response.ok||new URL(response.url).origin!==expected)throw Error('Publisher response unavailable');
  const body=await response.text();
  if(body.length>limit)throw Error('Publisher response exceeds bound');
  return JSON.parse(body);
}

export async function checkDirectPublicSafety(kind,now=Date.now()){
  if(kind==='seattle_fire'){
    const query=seattleFireAggregateQuery(now);
    const [rows,metadata]=await Promise.all([boundedJson(query.url,10000),boundedJson(seattleFireMetadataUrl,200000)]);
    return summarizeSeattleFireAggregate(rows,metadata,query,Date.now());
  }
  if(kind==='nashville_police'){
    const [metadata,count]=await Promise.all([boundedJson(`${nashvillePoliceLayer}?f=pjson`,200000),boundedJson(`${nashvillePoliceLayer}/query?f=json&where=1%3D1&returnCountOnly=true`,10000)]);
    return validateNashvillePoliceCount(metadata,count,Date.now());
  }
  throw Error('Unsupported public-safety check');
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-public-safety');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,venueId:main.dataset.venueId,kickoff:main.dataset.kickoff,status:main.dataset.eventStatus};
    const kind=directPublicSafetyKind(context);
    const source=kind==='seattle_fire'?seattleFireDataset:kind==='nashville_police'?nashvillePolicePage:null;
    const add=(tag,value,parent=panel)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node};
    const link=(url,label)=>{const p=add('p','');const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;p.append(a)};
    if(!kind){panel.closest('section')?.remove()}
    else{
      let pending=false,lastCheck=0;
      async function check(){
        if(pending||document.visibilityState!=='visible'||Date.now()-lastCheck<270000)return;
        pending=true;lastCheck=Date.now();panel.replaceChildren();add('p','Checking the public-safety aggregate…');
        try{
          const result=await checkDirectPublicSafety(kind);
          panel.replaceChildren();
          if(kind==='seattle_fire'){
            add('p',`Checked ${result.checkedAt}; city dataset updated ${result.sourceUpdatedAt}. ${result.nearbyCount} source-listed fire dispatches in a rolling two-hour window within 5 km of the unreviewed Lumen Field point. Window: ${result.windowStartLocal} to ${result.windowEndLocal} America/Los_Angeles.`);
            add('p','The public count includes fire and medical calls. It contains no incident details and is not a stadium incident, police alert, trend, or threat finding. A zero count is not an all-clear.');
            link(result.sourceUrl,'Seattle Fire public dataset ↗');
          }else{
            add('p',`Checked ${result.checkedAt}; city dataset updated ${result.sourceUpdatedAt}. ${result.activeCount} active major police dispatches listed citywide by Metro Nashville Police.`);
            add('p','This is a citywide count with no call details or stadium-area attribution. It is not a venue alert, trend, or threat finding. A zero count is not an all-clear.');
            link(result.agencyPageUrl,'Nashville Police active-dispatch page ↗');
          }
          add('p','This direct browser check is newer than the hourly report and is not saved in its Markdown. Confirm operational meaning with the responsible agency.');
        }catch{
          panel.replaceChildren();add('p',`Direct ${kind==='seattle_fire'?'Seattle Fire':'Nashville Police'} aggregate check unavailable. The hourly report below may be older; verify current information with the publisher.`);
          link(source,'Official public source ↗');
        }finally{pending=false}
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
