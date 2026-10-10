import fs from 'node:fs/promises';
import {nashvillePoliceLayer,nashvillePolicePage,validateNashvillePoliceCount} from '../site/nashville_police_aggregate.js';

const get=async url=>{
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'EventAtlas/0.4 citywide count-only source'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  return response.json();
};

let output;
try{
  const metadata=await get(`${nashvillePoliceLayer}?f=pjson`);
  const count=await get(`${nashvillePoliceLayer}/query?f=json&where=1%3D1&returnCountOnly=true`);
  output=validateNashvillePoliceCount(metadata,count);
}catch(error){
  output={schema:'event-atlas.nashville-police-count.v1',status:'failed',checkedAt:new Date().toISOString(),sourceUpdatedAt:null,scope:'Metro Nashville Police current active major dispatches citywide',activeCount:null,sourceUrl:nashvillePoliceLayer,agencyPageUrl:nashvillePolicePage,error:String(error.message||error).slice(0,180)};
}
await fs.writeFile('site/nashville_police_count.json',JSON.stringify(output)+'\n');
console.log(`Nashville police aggregate: ${output.status}${output.activeCount===null?'':`; ${output.activeCount} citywide active calls`}`);
