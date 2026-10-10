export const phillyCityAlertsUrl='https://api.phila.gov/phila/site-wide-alerts/v1';

const compact=value=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500):'';
const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&['phila.gov','www.phila.gov'].includes(url.hostname)?url.href:null}catch{return null}};

export function summarizePhillyCityAlerts(payload,checkedAt=Date.now()){
  if(!Array.isArray(payload)||payload.length>20||!Number.isFinite(checkedAt))throw Error('Philadelphia city-alert response is not a bounded array');
  let invalidCount=0;
  const alerts=[];
  for(const item of payload){
    if(!item||typeof item!=='object'||Array.isArray(item)){invalidCount++;continue}
    const title=compact(item.title||item.headline||item.heading||item.name);
    const detail=compact(item.message||item.description||item.body||item.summary);
    if(!title&&!detail){invalidCount++;continue}
    alerts.push({title:title||'City notice',detail,url:safeUrl(item.url||item.link)||phillyCityAlertsUrl});
  }
  return {state:invalidCount?'partial':'retrieved',checkedAt,totalReturned:payload.length,invalidCount,alerts,sourceUrl:phillyCityAlertsUrl};
}
