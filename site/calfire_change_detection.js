import {CALFIRE_URL} from './calfire_active.js';

const incidentUrl=url=>/^https:\/\/www\.fire\.ca\.gov\/incidents\/\d{4}\/\d{1,2}\/\d{1,2}\/[a-z0-9-]+$/.test(url||'');
const validRow=item=>incidentUrl(item?.sourceUrl)&&typeof item.name==='string'&&item.name.length>0&&item.name.length<=150&&typeof item.started==='string'&&/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(item.started)&&Number.isSafeInteger(item.acres)&&item.acres>=0&&Number.isInteger(item.containmentPercent)&&item.containmentPercent>=0&&item.containmentPercent<=100;
export const validCalfireContext=value=>value===null||value?.sourceUrl===CALFIRE_URL&&['current_county_listing','unavailable'].includes(value.state)&&['Los Angeles','Santa Clara'].includes(value.county)&&((value.state==='unavailable'&&!value.incidents)||value.state==='current_county_listing'&&Number.isFinite(Date.parse(value.checkedAt))&&Array.isArray(value.incidents)&&value.incidents.length<=10&&value.incidents.every(validRow));

export function diffCalfireCounty(prior,next,observedAt){
  if(!validCalfireContext(prior)||!validCalfireContext(next)||!prior||!next||prior.county!==next.county)return [];
  if(prior.state!==next.state)return [{kind:'source_status_changed',observedAt,title:`CAL FIRE ${next.county} County listing: ${prior.state} → ${next.state}`,detail:'The source check state changed. Recheck the CAL FIRE incident list; this is not evidence that a fire started or ended, or that the stadium is affected.',sourceUrl:CALFIRE_URL}];
  if(prior.state!=='current_county_listing'||next.state!=='current_county_listing')return [];
  const before=Date.parse(prior.checkedAt),after=Date.parse(next.checkedAt);
  if(!Number.isFinite(before)||!Number.isFinite(after)||after<=before)return [];
  const oldByUrl=new Map(prior.incidents.map(item=>[item.sourceUrl,item]));
  const changes=[];
  for(const item of next.incidents){
    const old=oldByUrl.get(item.sourceUrl);
    if(!old)changes.push({kind:'calfire_incident_listed',observedAt,title:`CAL FIRE ${next.county} County active listing: ${item.name}`,detail:`First displayed after a newer successful CAL FIRE table check. Publisher start date ${item.started}; listed acres ${item.acres}; containment ${item.containmentPercent}%. This county-level listing does not locate the fire near the stadium or establish smoke, access impact, or a threat. Verify the incident page and venue relevance.`,sourceUrl:item.sourceUrl});
    else if(old.acres!==item.acres||old.containmentPercent!==item.containmentPercent||old.name!==item.name)changes.push({kind:'calfire_incident_revised',observedAt,title:`CAL FIRE ${next.county} County listing revised: ${item.name}`,detail:`A newer successful CAL FIRE table check changed listed fields: acres ${old.acres} → ${item.acres}; containment ${old.containmentPercent}% → ${item.containmentPercent}%. A county-level publisher revision does not establish conditions at the stadium or a threat. Verify the current incident page.`,sourceUrl:item.sourceUrl});
  }
  return changes.slice(0,10);
}
