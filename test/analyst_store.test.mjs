import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AnalystStore} from '../lib/analyst_store.mjs';

test('operator tokens gate event writes and a separate reviewer records a decision',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-store-')),file=path.join(dir,'private','analyst.sqlite');
  try{
    const store=new AnalystStore(file);
    const analystToken=store.createOperator('test_analyst','Test Analyst','analyst');
    const reviewerToken=store.createOperator('test_reviewer','Test Reviewer','reviewer');
    assert.equal(store.authenticate('Bearer invalid'),null);
    assert.equal(store.authenticate(`Bearer ${analystToken}`).id,'test_analyst');
    const event=store.createEvent(store.authenticate(`Bearer ${analystToken}`),{title:'Synthetic event',sourceUrl:'https://example.org/event'});
    assert.equal(store.listEvents()[0].status,'unreviewed');
    assert.throws(()=>store.reviewEvent(store.authenticate(`Bearer ${analystToken}`),event.id,'accepted_for_register','A source check with sufficient detail.'),/Reviewer role required/);
    const review=store.reviewEvent(store.authenticate(`Bearer ${reviewerToken}`),event.id,'accepted_for_register','Synthetic source was checked for the test.');
    assert.equal(review.reviewerId,'test_reviewer');
    assert.equal(store.listEvents()[0].status,'accepted_for_register');
    assert.equal(store.auditSummary().entries,4);
    store.revokeOperator('test_analyst');
    assert.equal(store.authenticate(`Bearer ${analystToken}`),null);
    store.close();
    const reopened=new AnalystStore(file);assert.equal(reopened.auditSummary().entries,5);reopened.close();
    assert.equal(fs.statSync(file).mode&0o777,0o600);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('event payload tampering prevents store startup',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-record-')),file=path.join(dir,'private','analyst.sqlite');
  try{const store=new AnalystStore(file);const token=store.createOperator('test_user','Test User','analyst');const operator=store.authenticate(`Bearer ${token}`);store.createEvent(operator,{title:'Original',sourceUrl:'https://example.org'});store.close();const db=new DatabaseSync(file);db.exec("UPDATE events SET payload_json='{}'");db.close();assert.throws(()=>new AnalystStore(file),/Event integrity mismatch/)}finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('case assessment preserves cited evidence and separates analyst from reviewer',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-case-')),file=path.join(dir,'private','analyst.sqlite');
  try{
    const store=new AnalystStore(file),analystToken=store.createOperator('case_analyst','Case Analyst','analyst'),reviewerToken=store.createOperator('case_reviewer','Case Reviewer','reviewer');
    const analyst=store.authenticate(`Bearer ${analystToken}`),reviewer=store.authenticate(`Bearer ${reviewerToken}`);
    const subject={type:'voting_site',id:'synthetic-site',title:'Synthetic voting site',sourceUrl:'https://example.org/site',retrievedAt:'2026-10-09T12:00:00Z'};
    const caseRecord=store.createCase(analyst,subject,'Protective review of a sourced election site.','Synthetic election office','A documented source observation warrants local analyst triage.');
    assert.equal(store.getCaseFor(reviewer,caseRecord.id),null);
    const grant=store.assignCaseReviewer(analyst,caseRecord.id,reviewer.id,'This reviewer is assigned to the synthetic election case.');
    assert.equal(store.getCaseFor(reviewer,caseRecord.id).case.id,caseRecord.id);
    const input={severity:'review_candidate',confidence:'low',analysis:'A cited source claim requires verification against current site operations before any protective conclusion.',confidenceRationale:'Only one synthetic source is available, so confidence remains low.',impact:'Potential disruption would need confirmation by site operators.',alternativeExplanations:'The observation could reflect a stale notice or a routine change.',protectiveNexus:'The cited claim concerns the selected election site and its operation.',recommendation:'Verify the claim with the responsible authority.',limitations:'The synthetic source does not establish actual site impact.',evidence:[{url:'https://example.org/notice',observedAt:'2026-10-09T12:00:00Z',claim:'Synthetic source reports a site notice.',relevance:'The notice concerns the selected site.',classification:'official_notice'}]};
    assert.throws(()=>store.createAssessment(analyst,caseRecord.id,{...input,evidence:[]}),/timestamped HTTPS citations/);
    const assessment=store.createAssessment(analyst,caseRecord.id,input);
    assert.equal(assessment.automaticNotification,false);
    assert.equal(assessment.dissemination,'internal_only');
    assert.throws(()=>store.reviewAssessment(analyst,assessment.id,'accepted_for_internal_review','Sufficient synthetic reviewer rationale.'),/Reviewer role required/);
    store.reviewAssessment(reviewer,assessment.id,'accepted_for_internal_review','Citation and alternatives were checked in this synthetic test.');
    assert.equal(store.getCase(caseRecord.id).assessments[0].status,'accepted_for_internal_review');
    store.revokeCaseReviewer(analyst,grant.id,'The synthetic case review has concluded for this reviewer.');
    assert.equal(store.getCaseFor(reviewer,caseRecord.id),null);
    assert.deepEqual(store.listCasesFor(reviewer),[]);
    assert.equal(store.listBriefSnapshotsFor(reviewer,caseRecord.id),null);
    const regrant=store.assignCaseReviewer(analyst,caseRecord.id,reviewer.id,'A second synthetic review assignment is needed after revocation.');
    assert.equal(store.getCaseFor(reviewer,caseRecord.id).case.id,caseRecord.id);
    assert.equal(store.listCaseReviewersFor(analyst,caseRecord.id).filter(item=>!item.revokedAt).length,1);
    store.revokeCaseReviewer(analyst,regrant.id,'Second synthetic review assignment is complete and access ends.');
    store.close();
    const reopened=new AnalystStore(file);assert.equal(reopened.listCases()[0].assessmentCount,1);reopened.close();
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('case grant permissions and tamper detection survive restart',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-case-grant-')),file=path.join(dir,'private','analyst.sqlite');
  try{
    const store=new AnalystStore(file),a=store.createOperator('grant_analyst','Grant Analyst','analyst'),r=store.createOperator('grant_reviewer','Grant Reviewer','reviewer'),analyst=store.authenticate(`Bearer ${a}`),reviewer=store.authenticate(`Bearer ${r}`);
    const c=store.createCase(analyst,{type:'published_event',id:'synthetic',sourceUrl:'https://example.org/event'},'Protective review of a synthetic published event.','Synthetic agency','The cited synthetic event warrants a case review.');
    assert.deepEqual(store.listCasesFor(reviewer),[]);
    assert.throws(()=>store.assignCaseReviewer(reviewer,c.id,analyst.id,'A reviewer cannot assign another operator to a case.'),/Case owner required/);
    const grant=store.assignCaseReviewer(analyst,c.id,reviewer.id,'Independent review of this synthetic event case is required.');
    store.close();const db=new DatabaseSync(file);db.prepare('UPDATE case_reviewers SET rationale=? WHERE id=?').run('Tampered grant rationale',grant.id);db.close();
    assert.throws(()=>new AnalystStore(file),/Case reviewer grant mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('audit chain corruption prevents store startup',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-audit-')),file=path.join(dir,'private','analyst.sqlite');
  try{const store=new AnalystStore(file);store.createOperator('test_user','Test User','analyst');store.close();const db=new DatabaseSync(file);db.exec("UPDATE audit SET action='altered' WHERE seq=1");db.close();assert.throws(()=>new AnalystStore(file),/Audit chain mismatch/)}finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('named professional records require a separately approved event scope and survive audited restart',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-person-')),file=path.join(dir,'private','analyst.sqlite');
  try{
    const store=new AnalystStore(file),analystToken=store.createOperator('person_analyst','Person Analyst','analyst'),reviewerToken=store.createOperator('person_reviewer','Person Reviewer','reviewer');
    const analyst=store.authenticate(`Bearer ${analystToken}`),reviewer=store.authenticate(`Bearer ${reviewerToken}`);
    const eventCase=store.createCase(analyst,{type:'published_event',id:'synthetic-nfl-event',title:'Synthetic NFL event',sourceUrl:'https://example.org/game'},'Protective event planning for designated officials.','Synthetic public safety agency','Published event and designated role require a bounded protective review.');
    store.assignCaseReviewer(analyst,eventCase.id,reviewer.id,'This reviewer checks the synthetic professional role scope.');
    const expiresAt=new Date(Date.now()+7*86400000).toISOString();
    const scope=store.requestPersonScope(analyst,eventCase.id,{role:'team_official',protectiveNexus:'A designated team official will attend the selected published event.',lawfulAuthority:'Synthetic agency protective assignment',collectionPurpose:'Prepare a bounded protective event brief.',expiresAt});
    const input={displayName:'Jordan Example',role:'team_official',professionalRole:'Synthetic team president',designationSource:{url:'https://example.org/official',authority:'Synthetic team',observedAt:new Date().toISOString()},identityConfidence:'moderate',identityRationale:'Name and professional role match the synthetic source record.',publicProfessionalFacts:[{claim:'Serves as the synthetic team president.',sourceUrl:'https://example.org/official',observedAt:new Date().toISOString()}],retentionUntil:new Date(Date.now()+6*86400000).toISOString()};
    assert.throws(()=>store.createProtectedPerson(analyst,scope.id,input),/Active approved scope required/);
    assert.throws(()=>store.reviewPersonScope(analyst,scope.id,'approved','Synthetic reviewer approval with enough detail.'),/Reviewer role required/);
    store.reviewPersonScope(reviewer,scope.id,'approved','The synthetic protective nexus and role scope are bounded.');
    assert.throws(()=>store.createProtectedPerson(analyst,scope.id,{...input,role:'player'}),/role must match/);
    const person=store.createProtectedPerson(analyst,scope.id,input);
    assert.equal(person.dissemination,'internal_only');
    assert.equal(store.getPersonScopes(eventCase.id)[0].people[0].status,'pending_review');
    store.reviewProtectedPerson(reviewer,person.id,'approved','The synthetic identity source and facts were checked.');
    store.close();
    const reopened=new AnalystStore(file);
    assert.equal(reopened.getPersonScopes(eventCase.id)[0].people[0].status,'approved');
    reopened.close();
    const db=new DatabaseSync(file);db.prepare('UPDATE protected_people SET payload_json=? WHERE id=?').run('{}',person.id);db.close();
    assert.throws(()=>new AnalystStore(file),/protected_people integrity mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('saved brief versions retain exact content, chain hashes, and independent review',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-brief-')),file=path.join(dir,'private','analyst.sqlite');
  try{
    const store=new AnalystStore(file),analystToken=store.createOperator('brief_analyst','Brief Analyst','analyst'),reviewerToken=store.createOperator('brief_reviewer','Brief Reviewer','reviewer');
    const analyst=store.authenticate(`Bearer ${analystToken}`),reviewer=store.authenticate(`Bearer ${reviewerToken}`);
    const record=store.createCase(analyst,{type:'published_event',id:'synthetic-game',title:'Synthetic game',sourceUrl:'https://example.org/game'},'Protective review of a published synthetic event.','Synthetic agency','An official synthetic event notice supports opening this case.');
    store.assignCaseReviewer(analyst,record.id,reviewer.id,'This reviewer checks synthetic saved brief versions.');
    const makeBrief=version=>{const trace=store.recordBriefRequest(analyst,record.id);return {schema:'event-atlas.internal-event-case-brief.v1',case:{id:record.id},generatedBy:analyst.id,generatedAt:trace.generatedAt,localAuditHead:trace.auditHead,version}};
    const first=store.saveBriefSnapshot(analyst,record.id,makeBrief(1));
    const second=store.saveBriefSnapshot(analyst,record.id,makeBrief(2));
    assert.equal(second.sequence,2);assert.equal(second.previousHash,first.contentHash);
    assert.equal(store.getBriefSnapshotFor(analyst,first.id).brief.version,1);
    assert.equal(store.getBriefSnapshotFor(analyst,second.id).brief.version,2);
    assert.throws(()=>store.reviewBriefSnapshot(reviewer,first.id,'accepted_for_internal_review','Synthetic review of old version.'),/Superseded/);
    assert.throws(()=>store.reviewBriefSnapshot(analyst,second.id,'accepted_for_internal_review','Synthetic review of new version.'),/Reviewer role required/);
    store.reviewBriefSnapshot(reviewer,second.id,'accepted_for_internal_review','The synthetic current version and source were checked.');
    assert.equal(store.listBriefSnapshotsFor(analyst,record.id)[0].status,'accepted_for_internal_review');
    store.close();
    const reopened=new AnalystStore(file);assert.equal(reopened.getBriefSnapshotFor(reviewer,second.id).brief.version,2);reopened.close();
    const db=new DatabaseSync(file);db.prepare('UPDATE brief_snapshots SET content_json=? WHERE id=?').run('{}',first.id);db.close();
    assert.throws(()=>new AnalystStore(file),/Brief snapshot integrity mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
