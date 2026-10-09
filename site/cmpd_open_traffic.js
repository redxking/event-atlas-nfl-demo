export const cmpdOpenTrafficFeed='https://cmpdinfo.charlottenc.gov/api/v2.1/TrafficRSS';
const distance=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};

export function summarizeCmpdOpenTraffic(records,venue,checkedAt){
  if(!Array.isArray(records)||records.length>500||!Number.isFinite(checkedAt)||!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon))throw Error('Bounded CMPD feed and venue point required');
  let nearby=0,invalid=0,newestAt=null;
  for(const record of records){
    const lat=Number(record.lat),lon=Number(record.lon),at=Date.parse(record.publishedAt);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<34.5||lat>36||lon< -81.8||lon> -79.5||!Number.isFinite(at)||at>checkedAt+60000){invalid++;continue}
    if(distance(venue.lat,venue.lon,lat,lon)<=5){nearby++;if(!newestAt||at>newestAt)newestAt=at}
  }
  return {state:invalid?'partial':'retrieved',checkedAt,sourceId:'cmpd-open-traffic-georss',radiusKm:5,totalOpen:records.length,nearby,invalidCount:invalid,newestNearbyAt:newestAt?new Date(newestAt).toISOString():null,sourceUrl:cmpdOpenTrafficFeed,interpretation:'CMPD labels feed entries open crashes, traffic-control malfunctions or roadway obstructions. Locations are approximate. Count within 5 km of an unreviewed stadium point is current roadway context, not a police alert, stadium incident, route impact or threat finding.'};
}

export function parseCmpdOpenTrafficXml(xml){
  if(typeof xml!=='string'||xml.length>250000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('CMPD XML size or declaration invalid');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')||doc.documentElement?.localName!=='rss')throw Error('Invalid CMPD RSS response');
  const items=[...doc.getElementsByTagName('item')];
  if(items.length>500)throw Error('CMPD RSS response exceeds bounded item limit');
  return items.map(item=>{
    const value=name=>[...item.children].find(child=>child.localName===name)?.textContent?.trim()||'';
    return {lat:value('lat'),lon:value('long'),publishedAt:value('pubDate')};
  });
}
