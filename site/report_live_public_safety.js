import {seattleFireAggregateQuery,seattleFireMetadataUrl,seattleFireDataset,summarizeSeattleFireAggregate} from './seattle_fire_aggregate.js';
import {nashvillePoliceLayer,nashvillePolicePage,validateNashvillePoliceCount} from './nashville_police_aggregate.js';
import {cmpdOpenTrafficFeed,parseCmpdOpenTrafficXml,summarizeCmpdOpenTraffic} from './cmpd_open_traffic.js';

const HOUR=3600000;
export function directPublicSafetyKind(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff);
  if(context?.monitoringMode!=='near_term_monitoring'||!Number.isFinite(kickoff)||kickoff+5*HOUR<now||kickoff-now>7*24*HOUR||/cancel|postpon|delay/i.test(context?.status||''))return null;
  if(context?.venueId==='3628')return Number.isFinite(context?.lat)&&context.lat>=34.5&&context.lat<=36&&Number.isFinite(context?.lon)&&context.lon>=-81.8&&context.lon<=-79.5?'cmpd_road':null;
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

export async function checkDirectPublicSafety(kind,now=Date.now(),venue=null){
  if(kind==='seattle_fire'){
    const query=seattleFireAggregateQuery(now);
    const [rows,metadata]=await Promise.all([boundedJson(query.url,10000),boundedJson(seattleFireMetadataUrl,200000)]);
    return summarizeSeattleFireAggregate(rows,metadata,query,Date.now());
  }
  if(kind==='nashville_police'){
    const [metadata,count]=await Promise.all([boundedJson(`${nashvillePoliceLayer}?f=pjson`,200000),boundedJson(`${nashvillePoliceLayer}/query?f=json&where=1%3D1&returnCountOnly=true`,10000)]);
    return validateNashvillePoliceCount(metadata,count,Date.now());
  }
  if(kind==='cmpd_road'){
    if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon)||venue.lat<34.5||venue.lat>36||venue.lon< -81.8||venue.lon> -79.5)throw Error('Charlotte venue point unavailable');
    const response=await fetch(cmpdOpenTrafficFeed,{cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/georss+xml, application/xml'}});
    if(!response.ok||new URL(response.url).origin!==new URL(cmpdOpenTrafficFeed).origin)throw Error('CMPD response unavailable');
    const xml=await response.text();
    return summarizeCmpdOpenTraffic(parseCmpdOpenTrafficXml(xml),venue,Date.now());
  }
  throw Error('Unsupported public-safety check');
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-public-safety');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,venueId:main.dataset.venueId,lat:Number(main.dataset.venueLat),lon:Number(main.dataset.venueLon),kickoff:main.dataset.kickoff,status:main.dataset.eventStatus};
    const kind=directPublicSafetyKind(context);
    const source=kind==='seattle_fire'?seattleFireDataset:kind==='nashville_police'?nashvillePolicePage:kind==='cmpd_road'?cmpdOpenTrafficFeed:null;
    const add=(tag,value,parent=panel)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node};
    const link=(url,label)=>{const p=add('p','');const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;p.append(a)};
    if(!kind){panel.closest('section')?.remove()}
    else{
      let pending=false,lastCheck=0;
      async function check(){
        if(pending||document.visibilityState!=='visible'||Date.now()-lastCheck<270000)return;
        pending=true;lastCheck=Date.now();panel.replaceChildren();add('p','Checking the public-safety aggregate…');
        try{
          const result=await checkDirectPublicSafety(kind,Date.now(),{lat:context.lat,lon:context.lon});
          panel.replaceChildren();
          if(kind==='seattle_fire'){
            add('p',`Checked ${result.checkedAt}; city dataset updated ${result.sourceUpdatedAt}. ${result.nearbyCount} source-listed fire dispatches in a rolling two-hour window within 5 km of the unreviewed Lumen Field point. Window: ${result.windowStartLocal} to ${result.windowEndLocal} America/Los_Angeles.`);
            add('p','The public count includes fire and medical calls. It contains no incident details and is not a stadium incident, police alert, trend, or threat finding. A zero count is not an all-clear.');
            link(result.sourceUrl,'Seattle Fire public dataset ↗');
          }else if(kind==='nashville_police'){
            add('p',`Checked ${result.checkedAt}; city dataset updated ${result.sourceUpdatedAt}. ${result.activeCount} active major police dispatches listed citywide by Metro Nashville Police.`);
            add('p','This is a citywide count with no call details or stadium-area attribution. It is not a venue alert, trend, or threat finding. A zero count is not an all-clear.');
            link(result.agencyPageUrl,'Nashville Police active-dispatch page ↗');
          }else{
            add('p',`CMPD open roadway feed checked ${new Date(result.checkedAt).toISOString()}. ${result.nearby} of ${result.totalOpen} publisher-listed open roadway entries have approximate points within 5 km of the unreviewed Bank of America Stadium point.${result.state==='partial'?` ${result.invalidCount} entries could not be screened; the nearby count is incomplete.`:''}${result.newestNearbyAt?` Newest nearby publication: ${result.newestNearbyAt}.`:''}`);
            add('p','The feed covers open crashes, traffic-control malfunctions and obstructions. Individual titles, addresses and points are discarded after counting. This is not a police alert, stadium incident, verified route impact, or threat. Zero nearby entries is not an all-clear.');
            link(result.sourceUrl,'CMPD open roadway feed ↗');
          }
          add('p','This direct browser check may be newer than the hourly report and is not saved in its Markdown. Confirm operational meaning with the responsible agency.');
        }catch{
          panel.replaceChildren();add('p',`Direct ${kind==='seattle_fire'?'Seattle Fire':kind==='nashville_police'?'Nashville Police':'CMPD open roadway'} check unavailable or incomplete. The hourly report below may be older; verify current information with the publisher.`);
          link(source,'Official public source ↗');
        }finally{pending=false}
      }
      setTimeout(check,1500);
      setInterval(check,300000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
