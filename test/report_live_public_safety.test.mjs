import test from 'node:test';
import assert from 'node:assert/strict';
import {directPublicSafetyKind,checkDirectPublicSafety} from '../site/report_live_public_safety.js';

test('direct public-safety checks are limited to supported near-term games',()=>{
  const now=Date.parse('2026-10-10T12:00:00Z');
  const context={monitoringMode:'near_term_monitoring',venueId:'3673',kickoff:'2026-10-11T12:00:00Z',status:'scheduled'};
  assert.equal(directPublicSafetyKind(context,now),'seattle_fire');
  assert.equal(directPublicSafetyKind({...context,venueId:'3810'},now),'nashville_police');
  for(const changed of [{venueId:'3493'},{monitoringMode:'season_planning'},{status:'cancelled'},{kickoff:'2026-10-09T00:00:00Z'},{kickoff:'invalid'}]){
    assert.equal(directPublicSafetyKind({...context,...changed},now),null);
  }
});

test('Seattle direct check requests only a bounded count and rejects stale source metadata',async()=>{
  const original=globalThis.fetch,requested=[];
  const now=Date.now();
  globalThis.fetch=async url=>{
    requested.push(String(url));
    const metadata=String(url).includes('/api/views/')?{id:'kzjm-xkqj',name:'Seattle Real Time Fire 911 Calls',rowsUpdatedAt:Math.floor(now/1000)-120}:null;
    const rows=[{nearby:'0',latest:null}];
    return {ok:true,url:String(url),text:async()=>JSON.stringify(metadata||rows)};
  };
  try{
    const result=await checkDirectPublicSafety('seattle_fire',now);
    assert.equal(result.nearbyCount,0);
    assert.equal(requested.length,2);
    const query=new URL(requested.find(url=>url.includes('/resource/')));
    assert.equal(query.searchParams.get('$select'),'count(*) as nearby,max(datetime) as latest');
    assert.equal(query.searchParams.get('$where').includes('within_circle'),true);
    assert.equal(requested.some(url=>/address|incident_number|response_type/.test(url)),false);
    globalThis.fetch=async url=>({ok:true,url:String(url),text:async()=>JSON.stringify(String(url).includes('/api/views/')?{id:'kzjm-xkqj',name:'Seattle Real Time Fire 911 Calls',rowsUpdatedAt:Math.floor(now/1000)-3600}:[{nearby:'0',latest:null}])});
    await assert.rejects(checkDirectPublicSafety('seattle_fire',now),/stale/);
  }finally{globalThis.fetch=original}
});

test('Nashville direct check requests a citywide count without individual calls',async()=>{
  const original=globalThis.fetch,requested=[];
  const now=Date.now();
  globalThis.fetch=async url=>{
    requested.push(String(url));
    const body=String(url).endsWith('?f=pjson')?{name:'MetroNashvillePoliceDepartmentActiveDispatch',type:'Table',capabilities:'Query,Extract',editingInfo:{dataLastEditDate:now-60000}}:{count:0};
    return {ok:true,url:String(url),text:async()=>JSON.stringify(body)};
  };
  try{
    const result=await checkDirectPublicSafety('nashville_police',now);
    assert.equal(result.activeCount,0);
    assert.equal(requested.length,2);
    assert.ok(requested.some(url=>url.includes('returnCountOnly=true')));
    assert.equal(requested.some(url=>url.includes('outFields')||url.includes('returnGeometry=true')),false);
  }finally{globalThis.fetch=original}
  await assert.rejects(checkDirectPublicSafety('other',now),/Unsupported/);
});
