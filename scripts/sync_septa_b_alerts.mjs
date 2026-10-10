import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import bindings from 'gtfs-realtime-bindings';
import {septaServiceAlertsFeed,summarizeSeptaFeed} from '../site/septa_b_alerts.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'site/septa_b_alerts.json');
try{
  const response=await fetch(septaServiceAlertsFeed,{headers:{Accept:'application/x-protobuf','User-Agent':'EventAtlas-NFL-Demo/0.4'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<10||bytes.length>1000000)throw Error('GTFS-RT feed size outside bound');
  const decoded=bindings.transit_realtime.FeedMessage.decode(bytes);
  const feed=bindings.transit_realtime.FeedMessage.toObject(decoded,{enums:String,longs:String});
  const snapshot=summarizeSeptaFeed(feed);
  await fs.writeFile(output,JSON.stringify(snapshot)+'\n');
  console.log(JSON.stringify({status:snapshot.status,sourceAt:snapshot.sourceAt,matchingCount:snapshot.matchingCount}));
}catch(error){
  const previous=JSON.parse(await fs.readFile(output,'utf8').catch(()=>'null'));
  if(previous?.status==='ok'||previous?.status==='partial')console.error(`SEPTA refresh failed; retaining dated snapshot: ${error.message}`);
  else await fs.writeFile(output,JSON.stringify({status:'error',retrievedAt:new Date().toISOString(),sourceAt:null,sourceUrl:septaServiceAlertsFeed,alerts:[]})+'\n');
}
