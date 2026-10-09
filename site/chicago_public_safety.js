export const chicagoCrimeDataset='https://data.cityofchicago.org/Public-Safety/Crimes-2001-to-Present/ijzp-q8t2';
const endpoint='https://data.cityofchicago.org/resource/ijzp-q8t2.json';
const DAY=86400000;

export function chicagoCrimeQuery(venue,now=Date.now()){
  if(!Number.isFinite(venue?.lat)||!Number.isFinite(venue?.lon)||!Number.isFinite(now))throw Error('Chicago query requires a venue point and time');
  const end=new Date(Math.floor(now/DAY)*DAY-8*DAY).toISOString().slice(0,10);
  const start=new Date(Date.parse(end+'T00:00:00Z')-30*DAY).toISOString().slice(0,10);
  const url=new URL(endpoint);
  url.searchParams.set('$select','count(*) as count');
  url.searchParams.set('$where',`date >= '${start}T00:00:00' and date < '${end}T00:00:00' and within_circle(location, ${venue.lat}, ${venue.lon}, 5000)`);
  return {url:url.href,start,end,radiusKm:5};
}

export function summarizeChicagoCrimes(response,query,checkedAt){
  const count=Number(response?.[0]?.count);
  if(!Array.isArray(response)||response.length!==1||!Number.isSafeInteger(count)||count<0||!/^\d{4}-\d{2}-\d{2}$/.test(query?.start)||!/^\d{4}-\d{2}-\d{2}$/.test(query?.end))throw Error('Chicago aggregate response is incomplete');
  return {nearby:count,start:query.start,end:query.end,radiusKm:query.radiusKm,checkedAt};
}
