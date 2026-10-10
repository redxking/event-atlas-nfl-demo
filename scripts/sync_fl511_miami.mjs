import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const endpoint='https://www.fl511.com/List/GetData/traffic';
const pageUrl='https://www.fl511.com/list/events/traffic';
const clip=(value,max)=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,max);

export function summarizeFl511Pages(pages,checkedAt){
  if(!Array.isArray(pages)||pages.length<1||pages.length>10||!Number.isFinite(Date.parse(checkedAt)))throw Error('Bounded FL511 pages required');
  const total=pages[0]?.recordsTotal,rows=[];
  if(!Number.isInteger(total)||total<0||total>1000)throw Error('Unexpected FL511 total');
  for(const [index,page] of pages.entries()){
    if(page?.recordsTotal!==total||page.recordsFiltered!==total||!Array.isArray(page.data)||page.data.length>100||page.data.length!==Math.min(100,Math.max(0,total-index*100)))throw Error('FL511 pagination changed or incomplete');
    rows.push(...page.data);
  }
  if(rows.length!==total||new Set(rows.map(row=>row.id)).size!==total)throw Error('FL511 list changed during pagination');
  const records=rows.filter(row=>row.county==='Miami-Dade').map(row=>{
    if(!Number.isInteger(row.id)||row.id<1||typeof row.type!=='string'||row.type.length<1||row.type.length>80||typeof row.roadwayName!=='string'||typeof row.lastUpdated!=='string'||!/^\d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2} [AP]M$/.test(row.lastUpdated))throw Error('Miami-Dade FL511 row changed schema');
    return {id:row.id,type:clip(row.type,60),roadway:clip(row.roadwayName,120),direction:clip(row.direction,40),description:clip(row.description,350),severity:clip(row.severity,40),startText:clip(row.startDate,40),lastUpdatedText:clip(row.lastUpdated,40),sourceUrl:pageUrl};
  });
  if(records.length>50)throw Error('Miami-Dade FL511 rows exceeded report bound');
  return {schema:'event-atlas.fl511-miami.v1',status:'ok',checkedAt,sourceUrl:pageUrl,endpoint,scope:'Miami-Dade County traffic list; no stadium distance or route match',statewideCount:total,countyCount:records.length,records,interpretation:'FL511 public road-list rows are publisher listings with displayed wall-clock times of unverified zone. County scope does not establish active status, stadium access, event-window overlap or threat.'};
}

export async function fetchFl511Miami({fetchImpl=fetch,now=new Date()}={}){
  const pages=[];
  for(let start=0;start===0||start<pages[0].recordsTotal;start+=100){
    if(pages.length>=10)throw Error('FL511 page limit reached');
    const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','User-Agent':'EventAtlas/0.4 public-road-list'},body:JSON.stringify({draw:pages.length+1,start,length:100,search:{value:'',regex:false},order:[{column:8,dir:'desc'}],columns:[]}),signal:AbortSignal.timeout(15000)});
    if(!response.ok||!String(response.headers.get('content-type')||'').includes('application/json'))throw Error(`FL511 HTTP ${response.status}`);
    const body=await response.text();
    if(body.length>1_000_000)throw Error('FL511 page oversized');
    pages.push(JSON.parse(body));
  }
  return summarizeFl511Pages(pages,now.toISOString());
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let output;
  try{output=await fetchFl511Miami()}catch(error){output={schema:'event-atlas.fl511-miami.v1',status:'failed',checkedAt:new Date().toISOString(),sourceUrl:pageUrl,endpoint,scope:'Miami-Dade County traffic list',statewideCount:null,countyCount:null,records:[],interpretation:'FL511 public road-list retrieval unavailable; no negative finding follows.'};console.log(`FL511 Miami unavailable: ${String(error.message).slice(0,120)}`)}
  await fs.writeFile(path.join(root,'site/fl511_miami.json'),JSON.stringify(output)+'\n');
  console.log(`FL511 Miami: ${output.status}; ${output.records.length} county rows`);
}
