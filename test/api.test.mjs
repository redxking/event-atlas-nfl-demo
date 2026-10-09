import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {AnalystStore} from '../lib/analyst_store.mjs';

async function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})})}

test('HTTP analyst register rejects anonymous writes and records a separate review',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-api-')),dbPath=path.join(dir,'private','analyst.sqlite');
  let child;
  try{
    const store=new AnalystStore(dbPath),analyst=store.createOperator('api_analyst','API Analyst','analyst'),reviewer=store.createOperator('api_reviewer','API Reviewer','reviewer');store.close();
    const port=await freePort(),base=`http://127.0.0.1:${port}`;
    child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),EVENT_ATLAS_ANALYST_DB:dbPath},stdio:'ignore'});
    let ready=false;for(let i=0;i<40;i++){try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
    assert.equal(ready,true,'test server should start');
    const venue=JSON.parse(fs.readFileSync('data/venues.json','utf8')).venues[0];
    const payload={title:'Synthetic civic event',venueId:venue.id,startsAt:'2026-11-01T18:00:00.000Z',sourceUrl:'https://example.org/event',expectedAttendance:0};
    const post=async(token,body,origin)=>fetch(base+'/api/events',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
    assert.equal((await post(null,payload)).status,401);
    assert.equal((await post(analyst,payload,'https://outside.example')).status,403);
    const malformed=await fetch(base+'/api/events',{method:'POST',headers:{Authorization:`Bearer ${analyst}`,'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);
    const page=await fetch(base+'/');assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const createdResponse=await post(analyst,payload);assert.equal(createdResponse.status,201);const created=await createdResponse.json();assert.equal(created.owner,'API Analyst');assert.equal(created.status,'unreviewed');
    const list=await fetch(base+'/api/events',{headers:{Authorization:`Bearer ${reviewer}`}});assert.equal(list.status,200);assert.equal((await list.json()).items.length,1);
    const reviewResponse=await fetch(base+`/api/events/${created.id}/review`,{method:'POST',headers:{Authorization:`Bearer ${reviewer}`,'Content-Type':'application/json'},body:JSON.stringify({decision:'accepted_for_register',rationale:'Synthetic listing checked in this API test.'})});assert.equal(reviewResponse.status,201);
    assert.equal((await fetch(base+'/api/cases')).status,401);
    const votingChanges=await fetch(base+'/api/voting-changes?limit=1');assert.equal(votingChanges.status,200);assert.ok(Array.isArray((await votingChanges.json()).items));
    const votingList=await fetch(base+'/api/voting-locations?state=NY&limit=1');assert.equal(votingList.status,200);const votingListData=await votingList.json();assert.equal(typeof votingListData.staleCount,'number');assert.equal(typeof votingListData.items[0].connectorStatus,'string');
    const votingHistory=await fetch(base+'/api/voting-history?limit=1');assert.equal(votingHistory.status,200);const savedRuns=await votingHistory.json();assert.equal(savedRuns.verified,true);assert.ok(savedRuns.total>=0);if(savedRuns.total)assert.ok(savedRuns.items[0].archiveHash);
    const votingSnapshot=JSON.parse(fs.readFileSync('data/voting_locations.json','utf8'));
    const healthySources=new Set(votingSnapshot.sources.filter(source=>source.status==='ok').map(source=>source.id));
    const voting=votingSnapshot.locations.find(site=>healthySources.has(site.sourceId));
    assert.ok(voting,'synthetic API case needs a healthy source record');
    const siteDetail=await fetch(base+`/api/voting-location/${encodeURIComponent(voting.id)}`);assert.equal(siteDetail.status,200);assert.equal((await siteDetail.json()).source.id,voting.sourceId);
    const caseInput={subjectType:'voting_site',subjectId:voting.id,purpose:'Protective review of a sourced voting site.',authority:'Synthetic election office',openingRationale:'An analyst needs to document a cited observation for review.'};
    const openedResponse=await fetch(base+'/api/cases',{method:'POST',headers:{Authorization:`Bearer ${analyst}`,'Content-Type':'application/json'},body:JSON.stringify(caseInput)});assert.equal(openedResponse.status,201);const opened=await openedResponse.json();assert.equal(opened.subject.id,voting.id);assert.equal(typeof opened.subject.connectorStatus,'string');assert.equal(typeof opened.subject.sourceDataStatus,'string');
    const assessmentInput={severity:'review_candidate',confidence:'low',analysis:'This synthetic site notice requires a current source check before any operational inference.',confidenceRationale:'The synthetic example has a single source and no independent corroboration.',impact:'Potential site disruption would need confirmation from election officials.',alternativeExplanations:'The cited notice may be stale or refer to routine site maintenance.',protectiveNexus:'The claim references the selected sourced voting location.',recommendation:'Confirm the notice with the responsible election office.',limitations:'No real-world site condition is established by this synthetic test.',evidence:[{url:'https://example.org/notice',observedAt:'2026-10-09T12:00:00Z',claim:'Synthetic site notice published.',relevance:'The notice names the selected site.',classification:'official_notice'}]};
    const assessmentResponse=await fetch(base+`/api/cases/${opened.id}/assessments`,{method:'POST',headers:{Authorization:`Bearer ${analyst}`,'Content-Type':'application/json'},body:JSON.stringify(assessmentInput)});assert.equal(assessmentResponse.status,201);const assessment=await assessmentResponse.json();assert.equal(assessment.automaticNotification,false);
    const assessmentReview=await fetch(base+`/api/assessments/${assessment.id}/review`,{method:'POST',headers:{Authorization:`Bearer ${reviewer}`,'Content-Type':'application/json'},body:JSON.stringify({decision:'accepted_for_internal_review',rationale:'Synthetic evidence and alternatives checked for this API test.'})});assert.equal(assessmentReview.status,201);
    const caseDetail=await fetch(base+`/api/cases/${opened.id}`,{headers:{Authorization:`Bearer ${reviewer}`}});const detail=await caseDetail.json();assert.equal(detail.assessments[0].status,'accepted_for_internal_review');assert.equal(detail.sourceDrift.status,'unchanged_since_intake');
    const me=await fetch(base+'/api/operators/me',{headers:{Authorization:`Bearer ${reviewer}`}});const result=await me.json();assert.equal(result.audit.verified,true);assert.equal(result.audit.entries,7);
  }finally{child?.kill();fs.rmSync(dir,{recursive:true,force:true})}
});
