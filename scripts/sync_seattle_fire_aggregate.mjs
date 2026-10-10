import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seattleFireAggregateQuery,seattleFireMetadataUrl,summarizeSeattleFireAggregate} from '../site/seattle_fire_aggregate.js';

const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site/seattle_fire_aggregate.json');
const query=seattleFireAggregateQuery();
try{
  const headers={Accept:'application/json','User-Agent':'EventAtlas-NFL-Demo/0.4'};
  const [metaResponse,countResponse]=await Promise.all([fetch(seattleFireMetadataUrl,{headers,signal:AbortSignal.timeout(15000)}),fetch(query.url,{headers,signal:AbortSignal.timeout(15000)})]);
  if(!metaResponse.ok||!countResponse.ok||new URL(metaResponse.url).origin!=='https://data.seattle.gov'||new URL(countResponse.url).origin!=='https://data.seattle.gov')throw Error('Seattle Fire source request failed');
  const [metaRaw,countRaw]=await Promise.all([metaResponse.text(),countResponse.text()]);
  if(metaRaw.length>200000||countRaw.length>10000)throw Error('Seattle Fire source response exceeds bound');
  const result=summarizeSeattleFireAggregate(JSON.parse(countRaw),JSON.parse(metaRaw),query);
  await fs.writeFile(output,JSON.stringify(result)+'\n');
  console.log(JSON.stringify({status:result.status,nearbyCount:result.nearbyCount,sourceUpdatedAt:result.sourceUpdatedAt}));
}catch(error){
  const previous=JSON.parse(await fs.readFile(output,'utf8').catch(()=>'null'));
  if(previous?.status==='ok')console.error(`Seattle Fire aggregate refresh failed; retaining dated snapshot: ${error.message}`);
  else await fs.writeFile(output,JSON.stringify({schema:'event-atlas.seattle-fire-aggregate.v1',status:'error',checkedAt:new Date().toISOString(),sourceUrl:'https://data.seattle.gov/Public-Safety/Seattle-Real-Time-Fire-911-Calls/kzjm-xkqj',venueId:'3673',nearbyCount:null})+'\n');
}
