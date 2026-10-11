const HOUR=3600000;
export const ntasSourceUrl='https://www.dhs.gov/ntas/1.1/feed.xml';
export const spaceWeatherSourceUrl='https://services.swpc.noaa.gov/products/noaa-scales.json';
const fresh=(value,now,age)=>{const at=Date.parse(value);return Number.isFinite(at)&&at<=now+60000&&now-at<=age};
const scales=(value,nullable=false)=>value&&['G','R','S'].every(key=>nullable&&value[key]===null||Number.isInteger(value[key])&&value[key]>=0&&value[key]<=5);
const unavailable=(snapshot,sourceUrl)=>({state:'stale or unavailable',retrievedAt:snapshot?.retrievedAt||null,sourceUrl});
export function selectSpaceWeather(snapshot,now=Date.now()){
 if(snapshot?.status!=='ok'||snapshot.sourceUrl!==spaceWeatherSourceUrl||!fresh(snapshot.retrievedAt,now,6*HOUR)||!fresh(snapshot.observed?.at,now,6*HOUR)||!scales(snapshot.observed?.scales)||!Array.isArray(snapshot.outlook)||snapshot.outlook.length>3)return unavailable(snapshot,spaceWeatherSourceUrl);
 const retrieved=Date.parse(snapshot.retrievedAt);
 if(snapshot.outlook.some(item=>{const at=Date.parse(item?.at);return !Number.isFinite(at)||at<=retrieved-24*HOUR||at>retrieved+5*24*HOUR||!scales(item?.scales,true)}))return unavailable(snapshot,spaceWeatherSourceUrl);
 return {state:'current national snapshot',retrievedAt:snapshot.retrievedAt,sourceUrl:spaceWeatherSourceUrl,observed:{at:snapshot.observed.at,scales:{...snapshot.observed.scales}},outlook:snapshot.outlook.map(item=>({at:item.at,scales:{...item.scales}}))};
}
const strings=(values)=>Array.isArray(values)&&values.length<=50&&values.every(value=>typeof value==='string'&&value.length<=2000);
export function selectNtas(snapshot,now=Date.now()){
 if(snapshot?.status!=='ok'||snapshot.sourceUrl!==ntasSourceUrl||!fresh(snapshot.retrievedAt,now,12*HOUR)||!Array.isArray(snapshot.active)||snapshot.active.length>100||snapshot.activeCount!==snapshot.active.length)return unavailable(snapshot,ntasSourceUrl);
 const retrieved=Date.parse(snapshot.retrievedAt);
 if(snapshot.active.some(item=>{const start=Date.parse(item?.start),end=Date.parse(item?.end);return !Number.isFinite(start)||!Number.isFinite(end)||start>retrieved||end<=retrieved||typeof item?.url!=='string'||!/^https:\/\/www\.dhs\.gov\/[^\s]+$/.test(item.url)||typeof item.type!=='string'||item.type.length>240||typeof item.summary!=='string'||item.summary.length>50000||!strings(item.locations)||!strings(item.sectors)}))return unavailable(snapshot,ntasSourceUrl);
 const active=snapshot.active.filter(item=>Date.parse(item.start)<=now&&Date.parse(item.end)>now).map(item=>({type:item.type,start:item.start,end:item.end,url:item.url,summary:item.summary,locations:[...item.locations],sectors:[...item.sectors]}));
 return {state:'current national snapshot',retrievedAt:snapshot.retrievedAt,sourceUrl:ntasSourceUrl,active,activeCount:active.length,interpretation:'National publisher advisories are context; they do not establish a threat to this game or venue.'};
}
