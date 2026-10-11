// Coverage describes usable information, never event severity.
export function sourceCoverageGap(source){
 const state=String(source?.state||'').trim().toLowerCase().replace(/_/g,' ');
 // Connectors for another jurisdiction/event are outside scope, not failed checks here.
 if(/^outside source (?:area|city|jurisdiction|event)$/.test(state))return null;
 if(!state||state==='unknown')return 'Source status was not supplied';
 if(/failed|error/.test(state))return 'Source check failed';
 if(/stale|not current/.test(state))return 'Current information is unavailable';
 if(/not yet (?:checked|loaded)|not started/.test(state))return 'Source check is pending';
 if(/no connector|no coverage|no connected|no source|no current nearby station|unavailable|not screenable|cannot assess/.test(state))return 'Usable source coverage is unavailable';
 if(/outside.*(?:forecast|window)|outside forecast window|not screened outside/.test(state))return 'Source does not cover the event time';
 if(/no linked record|not verified|unverified|incomplete source alignment/.test(state))return 'Source linkage or verification is incomplete';
 if(state==='partial'||/partial source data/.test(state))return 'Only partial source data is available';
 if(/publisher directory only|publisher embed only|staging metadata connected/.test(state))return 'Camera access or freshness is limited';
 return null;
}
export function screeningPending(summary){return !summary||summary.screeningState==='pending'||summary.label==='Monitoring not started';}
