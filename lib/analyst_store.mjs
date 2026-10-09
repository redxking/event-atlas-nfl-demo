import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const iso=()=>new Date().toISOString();
const roles=new Set(['analyst','reviewer']);
const decisions=new Set(['accepted_for_register','returned_for_correction']);
const tokenPattern=/^[a-f0-9]{64}$/;
const severities=new Set(['informational','review_candidate','actionable_concern','urgent_concern']);
const confidences=new Set(['low','moderate','high']);
const assessmentDecisions=new Set(['accepted_for_internal_review','returned_for_correction']);
const validText=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
const validUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<=2000}catch{return false}};
const validTime=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));

export class AnalystStore {
  constructor(file){
    fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    fs.chmodSync(path.dirname(file),0o700);
    this.db=new DatabaseSync(file);
    fs.chmodSync(file,0o600);
    this.db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS operators(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('analyst','reviewer')),token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,disabled_at TEXT);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES operators(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,event_id TEXT NOT NULL UNIQUE REFERENCES events(id),reviewer_id TEXT NOT NULL REFERENCES operators(id),decision TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES operators(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessments(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),payload_json TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES operators(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_reviews(id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL UNIQUE REFERENCES assessments(id),reviewer_id TEXT NOT NULL REFERENCES operators(id),decision TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,occurred_at TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,payload_hash TEXT NOT NULL,prev_hash TEXT NOT NULL,entry_hash TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_action_entity ON audit(action,entity_id);
      CREATE INDEX IF NOT EXISTS assessments_case ON assessments(case_id,created_at);`);
    try{this.verifyAudit();this.verifyRecords()}catch(error){this.db.close();throw error}
  }
  close(){this.db.close()}
  verifyAudit(){
    let previous='0'.repeat(64);
    for(const row of this.db.prepare('SELECT * FROM audit ORDER BY seq').all()){
      const expected=hash(JSON.stringify([row.seq,row.occurred_at,row.actor_id,row.action,row.entity_id,row.payload_hash,previous]));
      if(row.prev_hash!==previous||row.entry_hash!==expected)throw Error(`Audit chain mismatch at entry ${row.seq}`);
      previous=row.entry_hash;
    }
    return previous;
  }
  verifyRecords(){
    for(const entry of this.db.prepare("SELECT action,entity_id FROM audit WHERE action IN ('operator.created','event.created','event.reviewed','case.created','assessment.created','assessment.reviewed')").all()){
      const table={'operator.created':'operators','event.created':'events','event.reviewed':'reviews','case.created':'cases','assessment.created':'assessments','assessment.reviewed':'assessment_reviews'}[entry.action];
      const column={'event.reviewed':'event_id','assessment.reviewed':'assessment_id'}[entry.action]||'id';
      if(!this.db.prepare(`SELECT 1 FROM ${table} WHERE ${column}=?`).get(entry.entity_id))throw Error(`Audit entity missing: ${entry.action} ${entry.entity_id}`);
    }
    for(const row of this.db.prepare('SELECT * FROM operators').all()){
      const created=this.db.prepare("SELECT * FROM audit WHERE action='operator.created' AND entity_id=?").get(row.id);
      if(!created||created.payload_hash!==hash(JSON.stringify({id:row.id,name:row.name,role:row.role})))throw Error(`Operator integrity mismatch: ${row.id}`);
      const revoked=this.db.prepare("SELECT * FROM audit WHERE action='operator.revoked' AND entity_id=?").get(row.id);
      if(row.disabled_at){if(!revoked||revoked.payload_hash!==hash(JSON.stringify({id:row.id,disabledAt:row.disabled_at})))throw Error(`Operator revocation mismatch: ${row.id}`)}
      else if(revoked)throw Error(`Operator revocation mismatch: ${row.id}`);
    }
    for(const row of this.db.prepare('SELECT * FROM events').all()){
      const created={...JSON.parse(row.payload_json),id:row.id,status:'unreviewed',createdBy:row.created_by,createdAt:row.created_at};
      const entry=this.db.prepare("SELECT * FROM audit WHERE action='event.created' AND entity_id=?").get(row.id);
      if(!entry||entry.actor_id!==row.created_by||entry.payload_hash!==hash(JSON.stringify(created)))throw Error(`Event integrity mismatch: ${row.id}`);
      const review=this.db.prepare('SELECT * FROM reviews WHERE event_id=?').get(row.id);
      if(row.status!==(review?.decision||'unreviewed'))throw Error(`Event status mismatch: ${row.id}`);
      if(review){
        const claim={id:review.id,eventId:row.id,reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at};
        const reviewEntry=this.db.prepare("SELECT * FROM audit WHERE action='event.reviewed' AND entity_id=?").get(row.id);
        if(!reviewEntry||reviewEntry.actor_id!==review.reviewer_id||reviewEntry.payload_hash!==hash(JSON.stringify(claim)))throw Error(`Review integrity mismatch: ${row.id}`);
      }
    }
    for(const row of this.db.prepare('SELECT * FROM cases').all()){
      const created={...JSON.parse(row.payload_json),id:row.id,status:'open',createdBy:row.created_by,createdAt:row.created_at};
      const entry=this.db.prepare("SELECT * FROM audit WHERE action='case.created' AND entity_id=?").get(row.id);
      if(row.status!=='open'||!entry||entry.actor_id!==row.created_by||entry.payload_hash!==hash(JSON.stringify(created)))throw Error(`Case integrity mismatch: ${row.id}`);
    }
    for(const row of this.db.prepare('SELECT * FROM assessments').all()){
      const created={...JSON.parse(row.payload_json),id:row.id,caseId:row.case_id,status:'pending_review',createdBy:row.created_by,createdAt:row.created_at};
      const entry=this.db.prepare("SELECT * FROM audit WHERE action='assessment.created' AND entity_id=?").get(row.id);
      if(!entry||entry.actor_id!==row.created_by||entry.payload_hash!==hash(JSON.stringify(created)))throw Error(`Assessment integrity mismatch: ${row.id}`);
      const review=this.db.prepare('SELECT * FROM assessment_reviews WHERE assessment_id=?').get(row.id);
      if(row.status!==(review?.decision||'pending_review'))throw Error(`Assessment status mismatch: ${row.id}`);
      if(review){
        const claim={id:review.id,assessmentId:row.id,reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at};
        const reviewEntry=this.db.prepare("SELECT * FROM audit WHERE action='assessment.reviewed' AND entity_id=?").get(row.id);
        if(!reviewEntry||reviewEntry.actor_id!==review.reviewer_id||reviewEntry.payload_hash!==hash(JSON.stringify(claim)))throw Error(`Assessment review mismatch: ${row.id}`);
      }
    }
  }
  audit(actor,action,entity,payload){
    const previous=this.db.prepare('SELECT entry_hash FROM audit ORDER BY seq DESC LIMIT 1').get()?.entry_hash||'0'.repeat(64);
    const seq=(this.db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS next FROM audit').get()).next;
    const occurred=iso(),payloadHash=hash(JSON.stringify(payload));
    const entryHash=hash(JSON.stringify([seq,occurred,actor,action,entity,payloadHash,previous]));
    this.db.prepare('INSERT INTO audit(seq,occurred_at,actor_id,action,entity_id,payload_hash,prev_hash,entry_hash) VALUES(?,?,?,?,?,?,?,?)').run(seq,occurred,actor,action,entity,payloadHash,previous,entryHash);
  }
  transaction(work){this.verifyAudit();this.verifyRecords();this.db.exec('BEGIN IMMEDIATE');try{const result=work();this.db.exec('COMMIT');return result}catch(error){this.db.exec('ROLLBACK');throw error}}
  createOperator(id,name,role){
    if(!/^[a-z][a-z0-9_-]{2,39}$/.test(id)||typeof name!=='string'||!name.trim()||name.length>100||!roles.has(role))throw Error('Valid operator id, name, and role required');
    const token=crypto.randomBytes(32).toString('hex');
    this.transaction(()=>{this.db.prepare('INSERT INTO operators(id,name,role,token_hash,created_at) VALUES(?,?,?,?,?)').run(id,name.trim(),role,hash(token),iso());this.audit('local-admin','operator.created',id,{id,name:name.trim(),role})});
    return token;
  }
  revokeOperator(id){
    return this.transaction(()=>{const row=this.db.prepare('SELECT id,disabled_at FROM operators WHERE id=?').get(id);if(!row)throw Error('Operator not found');if(row.disabled_at)throw Error('Operator already revoked');const disabledAt=iso();this.db.prepare('UPDATE operators SET disabled_at=? WHERE id=?').run(disabledAt,id);this.audit('local-admin','operator.revoked',id,{id,disabledAt});return disabledAt});
  }
  authenticate(header){
    this.verifyAudit();this.verifyRecords();
    const match=/^Bearer ([a-f0-9]{64})$/.exec(header||'');
    if(!match||!tokenPattern.test(match[1]))return null;
    const candidate=Buffer.from(hash(match[1]),'hex');
    for(const row of this.db.prepare('SELECT id,name,role,token_hash FROM operators WHERE disabled_at IS NULL').all()){
      if(crypto.timingSafeEqual(candidate,Buffer.from(row.token_hash,'hex')))return {id:row.id,name:row.name,role:row.role};
    }
    return null;
  }
  listEvents(){this.verifyAudit();this.verifyRecords();return this.db.prepare(`SELECT e.id,e.payload_json,e.status,e.created_by,e.created_at,r.reviewer_id,r.decision,r.rationale,r.created_at AS reviewed_at FROM events e LEFT JOIN reviews r ON r.event_id=e.id ORDER BY e.created_at DESC`).all().map(row=>({...JSON.parse(row.payload_json),id:row.id,status:row.status,createdBy:row.created_by,createdAt:row.created_at,review:row.reviewer_id?{reviewerId:row.reviewer_id,decision:row.decision,rationale:row.rationale,createdAt:row.reviewed_at}:null}))}
  createEvent(operator,payload){
    if(!operator||!roles.has(operator.role))throw Error('Unauthorized operator');
    const id=crypto.randomUUID(),createdAt=iso(),record={...payload,id,status:'unreviewed',createdBy:operator.id,createdAt};
    this.transaction(()=>{this.db.prepare('INSERT INTO events(id,payload_json,status,created_by,created_at) VALUES(?,?,?,?,?)').run(id,JSON.stringify(payload),'unreviewed',operator.id,createdAt);this.audit(operator.id,'event.created',id,record)});
    return record;
  }
  reviewEvent(operator,id,decision,rationale){
    if(operator?.role!=='reviewer')throw Error('Reviewer role required');
    if(!decisions.has(decision)||typeof rationale!=='string'||rationale.trim().length<20||rationale.length>2000)throw Error('Decision and rationale of 20–2000 characters required');
    return this.transaction(()=>{
      const event=this.db.prepare('SELECT id,created_by,status FROM events WHERE id=?').get(id);
      if(!event)throw Error('Event not found');
      if(event.created_by===operator.id)throw Error('Creator cannot review own event');
      if(event.status!=='unreviewed')throw Error('Event already reviewed');
      const review={id:crypto.randomUUID(),eventId:id,reviewerId:operator.id,decision,rationale:rationale.trim(),createdAt:iso()};
      this.db.prepare('INSERT INTO reviews(id,event_id,reviewer_id,decision,rationale,created_at) VALUES(?,?,?,?,?,?)').run(review.id,id,operator.id,decision,review.rationale,review.createdAt);
      this.db.prepare('UPDATE events SET status=? WHERE id=?').run(decision,id);
      this.audit(operator.id,'event.reviewed',id,review);
      return review;
    });
  }
  listCases(){this.verifyAudit();this.verifyRecords();return this.db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all().map(row=>({...JSON.parse(row.payload_json),id:row.id,status:row.status,createdBy:row.created_by,createdAt:row.created_at,assessmentCount:this.db.prepare('SELECT COUNT(*) AS n FROM assessments WHERE case_id=?').get(row.id).n}))}
  getCase(id){this.verifyAudit();this.verifyRecords();const row=this.db.prepare('SELECT * FROM cases WHERE id=?').get(id);if(!row)return null;const assessments=this.db.prepare('SELECT * FROM assessments WHERE case_id=? ORDER BY created_at DESC').all(id).map(a=>{const review=this.db.prepare('SELECT * FROM assessment_reviews WHERE assessment_id=?').get(a.id);return {...JSON.parse(a.payload_json),id:a.id,caseId:id,status:a.status,createdBy:a.created_by,createdAt:a.created_at,review:review?{reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at}:null}});return {case:{...JSON.parse(row.payload_json),id:row.id,status:row.status,createdBy:row.created_by,createdAt:row.created_at},assessments}}
  createCase(operator,subject,purpose,authority,openingRationale){
    if(!operator||!roles.has(operator.role))throw Error('Unauthorized operator');
    if(!subject||!['published_event','voting_site'].includes(subject.type)||!subject.id||!validUrl(subject.sourceUrl)||!validText(purpose,20,500)||!validText(authority,3,120)||!validText(openingRationale,20,2000))throw Error('Case requires a sourced event or site, protective purpose, responsible authority, and opening rationale');
    const payload={subject,purpose:purpose.trim(),authority:authority.trim(),openingRationale:openingRationale.trim()};
    const record={...payload,id:crypto.randomUUID(),status:'open',createdBy:operator.id,createdAt:iso()};
    this.transaction(()=>{this.db.prepare('INSERT INTO cases(id,payload_json,status,created_by,created_at) VALUES(?,?,?,?,?)').run(record.id,JSON.stringify(payload),'open',operator.id,record.createdAt);this.audit(operator.id,'case.created',record.id,record)});
    return record;
  }
  createAssessment(operator,caseId,input){
    if(!operator||!roles.has(operator.role))throw Error('Unauthorized operator');
    if(!severities.has(input?.severity)||!confidences.has(input?.confidence)||!validText(input.analysis,50,5000)||!validText(input.confidenceRationale,20,2000)||!validText(input.impact,20,2000)||!validText(input.alternativeExplanations,20,2000)||!validText(input.protectiveNexus,20,2000)||!validText(input.recommendation,10,2000)||!validText(input.limitations,20,2000))throw Error('Assessment requires separate severity, confidence, reasoning, impact, alternatives, nexus, recommendation, and limitations');
    if(!Array.isArray(input.evidence)||input.evidence.length<1||input.evidence.length>20||input.evidence.some(e=>!validUrl(e?.url)||!validTime(e?.observedAt)||!validText(e?.claim,10,1000)||!validText(e?.relevance,10,1000)||!['observation','allegation','official_notice','analytic_context'].includes(e?.classification)))throw Error('Assessment requires 1–20 timestamped HTTPS citations with claim, relevance, and classification');
    const evidence=input.evidence.map(e=>({url:new URL(e.url).toString(),observedAt:new Date(e.observedAt).toISOString(),claim:e.claim.trim(),relevance:e.relevance.trim(),classification:e.classification}));
    const payload={severity:input.severity,confidence:input.confidence,analysis:input.analysis.trim(),confidenceRationale:input.confidenceRationale.trim(),impact:input.impact.trim(),alternativeExplanations:input.alternativeExplanations.trim(),protectiveNexus:input.protectiveNexus.trim(),recommendation:input.recommendation.trim(),limitations:input.limitations.trim(),evidence,dissemination:'internal_only',automaticNotification:false};
    return this.transaction(()=>{if(!this.db.prepare('SELECT id FROM cases WHERE id=?').get(caseId))throw Error('Case not found');const record={...payload,id:crypto.randomUUID(),caseId,status:'pending_review',createdBy:operator.id,createdAt:iso()};this.db.prepare('INSERT INTO assessments(id,case_id,payload_json,status,created_by,created_at) VALUES(?,?,?,?,?,?)').run(record.id,caseId,JSON.stringify(payload),'pending_review',operator.id,record.createdAt);this.audit(operator.id,'assessment.created',record.id,record);return record});
  }
  reviewAssessment(operator,id,decision,rationale){
    if(operator?.role!=='reviewer')throw Error('Reviewer role required');
    if(!assessmentDecisions.has(decision)||!validText(rationale,20,2000))throw Error('Decision and rationale of 20–2000 characters required');
    return this.transaction(()=>{const assessment=this.db.prepare('SELECT id,created_by,status FROM assessments WHERE id=?').get(id);if(!assessment)throw Error('Assessment not found');if(assessment.created_by===operator.id)throw Error('Creator cannot review own assessment');if(assessment.status!=='pending_review')throw Error('Assessment already reviewed');const review={id:crypto.randomUUID(),assessmentId:id,reviewerId:operator.id,decision,rationale:rationale.trim(),createdAt:iso()};this.db.prepare('INSERT INTO assessment_reviews(id,assessment_id,reviewer_id,decision,rationale,created_at) VALUES(?,?,?,?,?,?)').run(review.id,id,operator.id,decision,review.rationale,review.createdAt);this.db.prepare('UPDATE assessments SET status=? WHERE id=?').run(decision,id);this.audit(operator.id,'assessment.reviewed',id,review);return review});
  }
  auditSummary(){this.verifyAudit();this.verifyRecords();const row=this.db.prepare('SELECT seq,entry_hash FROM audit ORDER BY seq DESC LIMIT 1').get();return {entries:row?.seq||0,head:row?.entry_hash||'0'.repeat(64),verified:true}}
}
