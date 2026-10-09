import fs from 'node:fs/promises';
const types = [
  ['stadium','Q483110'],['arena','Q641226'],['convention center','Q1378975'],
  ['concert hall','Q1060829'],['theatre','Q11635'],['amphitheatre','Q54831'],
  ['fairground','Q1408777'],['racetrack','Q1118667'],
  ['theatre building','Q24354'],['auditorium','Q230752'],['sports venue','Q1076486'],
  ['music venue','Q8719053'],['performing arts center','Q3469910'],['race track','Q1777138']
];
const ua='EventAtlas/0.1 (local public-data prototype)';
async function load([category,id]) {
 const q=`SELECT DISTINCT ?item ?itemLabel ?coord ?capacity ?website ?street ?postal ?cityLabel ?adminLabel WHERE { ?item wdt:P17 wd:Q30; wdt:P625 ?coord; wdt:P31/wdt:P279* wd:${id}. OPTIONAL { ?item wdt:P1083 ?capacity } OPTIONAL { ?item wdt:P856 ?website } OPTIONAL { ?item wdt:P6375 ?street } OPTIONAL { ?item wdt:P281 ?postal } OPTIONAL { ?item wdt:P131 ?city. ?city rdfs:label ?cityLabel FILTER(LANG(?cityLabel)="en") } OPTIONAL { ?item wdt:P131/wdt:P131 ?admin. ?admin rdfs:label ?adminLabel FILTER(LANG(?adminLabel)="en") } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 15000`;
 const url='https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q);
 const response=await fetch(url,{headers:{'User-Agent':ua,'Accept':'application/sparql-results+json'},signal:AbortSignal.timeout(90000)});
 if(!response.ok) throw new Error(`${category} HTTP ${response.status}`);
 const data=await response.json();
 return data.results.bindings.map(b=>{
  const point=/Point\((-?[\d.]+) (-?[\d.]+)\)/.exec(b.coord.value);
  if(!point) return null;
  const get=k=>b[k]?.value||null;
  return {id:get('item').split('/').pop(),name:get('itemLabel'),type:category,lat:+point[2],lon:+point[1],capacity:get('capacity')?+get('capacity'):null,website:get('website'),street:get('street'),postal:get('postal'),city:get('cityLabel'),region:get('adminLabel'),source:get('item').replace('http://','https://')};
 }).filter(Boolean);
}
const output=[];const results=await Promise.allSettled(types.map(load));
for(let i=0;i<results.length;i++){const r=results[i];if(r.status==='fulfilled'){console.log(types[i][0],r.value.length);output.push(...r.value)}else console.error(types[i][0],String(r.reason))}
const unique=new Map();for(const v of output){const prior=unique.get(v.id);if(!prior || Object.values(v).filter(Boolean).length>Object.values(prior).filter(Boolean).length) unique.set(v.id,v)}
const snapshot={source:'Wikidata Query Service',retrievedAt:new Date().toISOString(),queryClasses:types,coverageNote:'Wikidata entries with U.S. country and coordinates in selected venue classes; not a complete census or an event schedule; may include historical venues and outdated names.',venues:[...unique.values()]};
await fs.writeFile('data/venues.json',JSON.stringify(snapshot));console.log('total',snapshot.venues.length);
