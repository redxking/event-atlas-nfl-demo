import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const sourceUrl='https://services.swpc.noaa.gov/products/noaa-scales.json';
const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site/noaa_space_weather.json');

export function parseNoaaScales(data,checkedAt){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Unexpected NOAA scales payload');
  const now=Date.parse(checkedAt),current=data['0'];
  const parseEntry=(entry,key)=>{
    if(!entry||typeof entry.DateStamp!=='string'||typeof entry.TimeStamp!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.DateStamp)||!/^\d{2}:\d{2}:\d{2}$/.test(entry.TimeStamp))throw Error(`Invalid NOAA ${key} timestamp`);
    const at=`${entry.DateStamp}T${entry.TimeStamp}Z`,timestamp=Date.parse(at);
    if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString()!==at.replace('Z','.000Z'))throw Error(`Invalid NOAA ${key} date`);
    const scales={};
    for(const type of ['G','R','S']){
      const raw=entry[type]?.Scale;
      if(raw!==null&&raw!==undefined&&!/^[0-5]$/.test(String(raw)))throw Error(`Invalid NOAA ${type} scale`);
      scales[type]=raw===null||raw===undefined?null:Number(raw);
    }
    return {at,scales};
  };
  const observed=parseEntry(current,'current');
  if(!Number.isFinite(now)||Date.parse(observed.at)>now+60000||now-Date.parse(observed.at)>6*3600000)throw Error('NOAA current observation is stale or future dated');
  const outlook=[];
  for(const key of ['1','2','3']){
    if(!data[key])continue;
    const item=parseEntry(data[key],key);
    if(Date.parse(item.at)<=now-24*3600000||Date.parse(item.at)>now+5*24*3600000)throw Error('Unexpected NOAA outlook date');
    outlook.push(item);
  }
  return {source:'NOAA Space Weather Prediction Center',sourceUrl,scaleExplanationUrl:'https://www.swpc.noaa.gov/noaa-scales-explanation',retrievedAt:checkedAt,status:'ok',observed,outlook};
}

async function main(){
  const checkedAt=new Date().toISOString();
  let result;
  try{
    const fixture=process.argv.indexOf('--fixture');
    const raw=fixture>=0?await fs.readFile(process.argv[fixture+1],'utf8'):await (async()=>{
      const response=await fetch(sourceUrl,{headers:{Accept:'application/json','User-Agent':'EventAtlas NFL public report (https://github.com/redxking/event-atlas-nfl-demo)'},signal:AbortSignal.timeout(25000)});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const text=await response.text();
      if(text.length>100000)throw Error('Oversized NOAA response');
      return text;
    })();
    result=parseNoaaScales(JSON.parse(raw),checkedAt);
  }catch(error){result={source:'NOAA Space Weather Prediction Center',sourceUrl,retrievedAt:checkedAt,status:'unavailable',error:error.name||'Error'};}
  await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
  console.log(`NOAA space weather: ${result.status}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
