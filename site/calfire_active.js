export const CALFIRE_URL='https://www.fire.ca.gov/incidents/';

const unescapeHtml=value=>value.replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"');
const plain=value=>unescapeHtml(value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());

export function parseCalfireActive(html,checkedAt=new Date().toISOString()){
  if(typeof html!=='string'||html.length>2_000_000||!Number.isFinite(Date.parse(checkedAt)))throw Error('Invalid CAL FIRE response');
  const table=html.match(/<table\b[^>]*\bid=["']incidents["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if(!table||!/<caption>\s*Currently Active Incidents\s*<\/caption>/i.test(table))throw Error('CAL FIRE active table unavailable');
  const body=table.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if(!body)throw Error('CAL FIRE active rows unavailable');
  const rows=[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if(rows.length>100)throw Error('CAL FIRE active table exceeds bound');
  const incidents=rows.map(([,row])=>{
    const anchor=row.match(/<th\b[^>]*>[\s\S]*?<a\b[^>]*href=["'](\/incidents\/\d{4}\/\d{1,2}\/\d{1,2}\/[a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/th>/i);
    const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match=>plain(match[1]));
    if(!anchor||cells.length<4||cells.length>6)throw Error('Malformed CAL FIRE incident row');
    const name=plain(anchor[2]),counties=cells[0].split(/,\s*/).map(part=>part.trim()).filter(Boolean);
    const started=cells[1],acres=Number(cells[2].replaceAll(',','')),containment=Number(cells[3].match(/\d{1,3}(?=%)/)?.[0]);
    if(!name||name.length>150||!counties.length||counties.some(county=>county.length>80)||!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(started)||!Number.isSafeInteger(acres)||acres<0||!Number.isInteger(containment)||containment<0||containment>100)throw Error('Invalid CAL FIRE incident values');
    return {name,counties,started,acres,containmentPercent:containment,sourceUrl:new URL(anchor[1],CALFIRE_URL).href};
  });
  return {status:'ok',checkedAt:new Date(checkedAt).toISOString(),sourceUrl:CALFIRE_URL,incidents};
}

export function calfireCountyContext(snapshot,venueId,now=Date.now()){
  const county=String(venueId)==='7065'?'Los Angeles':String(venueId)==='4738'?'Santa Clara':null;
  if(!county)return {state:'outside_source_area'};
  const checked=Date.parse(snapshot?.checkedAt);
  if(snapshot?.status!=='ok'||!Array.isArray(snapshot.incidents)||!Number.isFinite(checked)||checked>now+60000||now-checked>12*3600000)return {state:'unavailable',county,sourceUrl:CALFIRE_URL};
  const incidents=snapshot.incidents.filter(item=>item.counties?.includes(county)).slice(0,10);
  return {state:'current_county_listing',county,checkedAt:new Date(checked).toISOString(),sourceUrl:CALFIRE_URL,incidents};
}
