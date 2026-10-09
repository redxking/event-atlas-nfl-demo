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
const scopeDecisions=new Set(['approved','rejected']);
const personDecisions=new Set(['approved','rejected']);
const briefDecisions=new Set(['accepted_for_internal_review','returned_for_correction']);
const protectiveRoles=new Set(['team_official','player','coach','league_official','elected_official','performer','other_designated']);
const caseReadActions=new Set(['case.listed','case.viewed','brief_snapshot.listed','brief_snapshot.viewed','case.access_log_viewed']);
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
      CREATE TABLE IF NOT EXISTS case_reviewers(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),reviewer_id TEXT NOT NULL REFERENCES operators(id),assigned_by TEXT NOT NULL REFERENCES operators(id),rationale TEXT NOT NULL,created_at TEXT NOT NULL,revoked_at TEXT,revoked_by TEXT REFERENCES operators(id),revocation_rationale TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS case_reviewers_active ON case_reviewers(case_id,reviewer_id) WHERE revoked_at IS NULL;
      CREATE TABLE IF NOT EXISTS case_access_log(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),operator_id TEXT NOT NULL REFERENCES operators(id),action TEXT NOT NULL,resource_id TEXT,occurred_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS case_access_case_time ON case_access_log(case_id,occurred_at);
      CREATE TABLE IF NOT EXISTS assessments(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),payload_json TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES operators(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_reviews(id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL UNIQUE REFERENCES assessments(id),reviewer_id TEXT NOT NULL REFERENCES operators(id),decision TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS person_scopes(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),payload_json TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES operators(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS person_scope_reviews(id TEXT PRIMARY KEY,scope_id TEXT NOT NULL UNIQUE REFERENCES person_scopes(id),reviewer_id TEXT NOT NULL REFERENCES operators(id),decision TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS protected_people(id TEXT PRIMARY KEY,scope_id TEXT NOT NULL REFERENCES person_scopes(id),payload_json TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES operators(id),created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS protected_person_reviews(id TEXT PRIMARY KEY,person_id TEXT NOT NULL UNIQUE REFERENCES protected_people(id),reviewer_id TEXT NOT NULL REFERENCES operators(id),decision TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS brief_snapshots(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),sequence INTEGER NOT NULL,content_json TEXT NOT NULL,content_hash TEXT NOT NULL,previous_hash TEXT NOT NULL,status TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES operators(id),created_at TEXT NOT NULL,UNIQUE(case_id,sequence));
      CREATE TABLE IF NOT EXISTS brief_snapshot_reviews(id TEXT PRIMARY KEY,brief_id TEXT NOT NULL UNIQUE REFERENCES brief_snapshots(id),reviewer_id TEXT NOT NULL REFERENCES operators(id),decision TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,occurred_at TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,payload_hash TEXT NOT NULL,prev_hash TEXT NOT NULL,entry_hash TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS audit_action_entity ON audit(action,entity_id);
      CREATE INDEX IF NOT EXISTS assessments_case ON assessments(case_id,created_at);
      CREATE INDEX IF NOT EXISTS brief_snapshots_case ON brief_snapshots(case_id,sequence);`);
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
    for(const entry of this.db.prepare("SELECT action,entity_id,payload_hash FROM audit WHERE action IN ('operator.created','event.created','event.reviewed','case.created','case_reviewer.assigned','case_reviewer.revoked','case.access','case.brief_requested','assessment.created','assessment.reviewed','person_scope.created','person_scope.reviewed','protected_person.created','protected_person.reviewed','brief_snapshot.created','brief_snapshot.reviewed')").all()){
      const table={'operator.created':'operators','event.created':'events','event.reviewed':'reviews','case.created':'cases','case_reviewer.assigned':'case_reviewers','case_reviewer.revoked':'case_reviewers','case.access':'case_access_log','case.brief_requested':'cases','assessment.created':'assessments','assessment.reviewed':'assessment_reviews','person_scope.created':'person_scopes','person_scope.reviewed':'person_scope_reviews','protected_person.created':'protected_people','protected_person.reviewed':'protected_person_reviews','brief_snapshot.created':'brief_snapshots','brief_snapshot.reviewed':'brief_snapshot_reviews'}[entry.action];
      const column={'event.reviewed':'event_id','assessment.reviewed':'assessment_id','person_scope.reviewed':'scope_id','protected_person.reviewed':'person_id','brief_snapshot.reviewed':'brief_id'}[entry.action]||'id';
      if(!this.db.prepare(`SELECT 1 FROM ${table} WHERE ${column}=?`).get(entry.entity_id))throw Error(`Audit entity missing: ${entry.action} ${entry.entity_id}`);
      if(entry.action==='case.brief_requested'&&entry.payload_hash!==hash(JSON.stringify({caseId:entry.entity_id})))throw Error(`Brief audit mismatch: ${entry.entity_id}`);
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
    for(const row of this.db.prepare('SELECT * FROM case_reviewers').all()){
      const grant={id:row.id,caseId:row.case_id,reviewerId:row.reviewer_id,assignedBy:row.assigned_by,rationale:row.rationale,createdAt:row.created_at};
      const entry=this.db.prepare("SELECT * FROM audit WHERE action='case_reviewer.assigned' AND entity_id=?").get(row.id);
      if(!entry||entry.actor_id!==row.assigned_by||entry.payload_hash!==hash(JSON.stringify(grant)))throw Error(`Case reviewer grant mismatch: ${row.id}`);
      const revoke=this.db.prepare("SELECT * FROM audit WHERE action='case_reviewer.revoked' AND entity_id=?").get(row.id);
      if(row.revoked_at){
        const claim={id:row.id,caseId:row.case_id,reviewerId:row.reviewer_id,revokedBy:row.revoked_by,revokedAt:row.revoked_at,rationale:row.revocation_rationale};
        if(!row.revoked_by||!row.revocation_rationale||!revoke||revoke.actor_id!==row.revoked_by||revoke.payload_hash!==hash(JSON.stringify(claim)))throw Error(`Case reviewer revocation mismatch: ${row.id}`);
      }else if(row.revoked_by||row.revocation_rationale||revoke)throw Error(`Case reviewer revocation mismatch: ${row.id}`);
    }
    for(const row of this.db.prepare('SELECT * FROM case_access_log').all()){
      const claim={id:row.id,caseId:row.case_id,operatorId:row.operator_id,action:row.action,resourceId:row.resource_id,occurredAt:row.occurred_at};
      const entry=this.db.prepare("SELECT * FROM audit WHERE action='case.access' AND entity_id=?").get(row.id);
      if(!caseReadActions.has(row.action)||!entry||entry.actor_id!==row.operator_id||entry.payload_hash!==hash(JSON.stringify(claim)))throw Error(`Case access integrity mismatch: ${row.id}`);
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
    for(const [table,reviewTable,foreignKey,createdAction,reviewAction,caseKey] of [
      ['person_scopes','person_scope_reviews','scope_id','person_scope.created','person_scope.reviewed','case_id'],
      ['protected_people','protected_person_reviews','person_id','protected_person.created','protected_person.reviewed','scope_id']]){
      for(const row of this.db.prepare(`SELECT * FROM ${table}`).all()){
        const created={...JSON.parse(row.payload_json),id:row.id,[caseKey==='case_id'?'caseId':'scopeId']:row[caseKey],status:'pending_review',createdBy:row.created_by,createdAt:row.created_at};
        const entry=this.db.prepare('SELECT * FROM audit WHERE action=? AND entity_id=?').get(createdAction,row.id);
        if(!entry||entry.actor_id!==row.created_by||entry.payload_hash!==hash(JSON.stringify(created)))throw Error(`${table} integrity mismatch: ${row.id}`);
        const review=this.db.prepare(`SELECT * FROM ${reviewTable} WHERE ${foreignKey}=?`).get(row.id);
        if(row.status!==(review?.decision||'pending_review'))throw Error(`${table} status mismatch: ${row.id}`);
        if(review){
          const claim={id:review.id,[caseKey==='case_id'?'scopeId':'personId']:row.id,reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at};
          const reviewEntry=this.db.prepare('SELECT * FROM audit WHERE action=? AND entity_id=?').get(reviewAction,row.id);
          if(!reviewEntry||reviewEntry.actor_id!==review.reviewer_id||reviewEntry.payload_hash!==hash(JSON.stringify(claim)))throw Error(`${reviewTable} integrity mismatch: ${row.id}`);
        }
      }
    }
    const lastHashByCase=new Map(),sequenceByCase=new Map();
    for(const row of this.db.prepare('SELECT * FROM brief_snapshots ORDER BY case_id,sequence').all()){
      const expectedHash=hash(row.content_json),brief=JSON.parse(row.content_json),previous=lastHashByCase.get(row.case_id)||'0'.repeat(64),sequence=(sequenceByCase.get(row.case_id)||0)+1;
      if(row.content_hash!==expectedHash||row.previous_hash!==previous||row.sequence!==sequence||brief.case?.id!==row.case_id||brief.schema!=='event-atlas.internal-event-case-brief.v1')throw Error(`Brief snapshot integrity mismatch: ${row.id}`);
      const claim={id:row.id,caseId:row.case_id,sequence:row.sequence,contentHash:row.content_hash,previousHash:row.previous_hash,status:'pending_review',createdBy:row.created_by,createdAt:row.created_at};
      const created=this.db.prepare("SELECT * FROM audit WHERE action='brief_snapshot.created' AND entity_id=?").get(row.id);
      if(!created||created.actor_id!==row.created_by||created.payload_hash!==hash(JSON.stringify(claim)))throw Error(`Brief snapshot audit mismatch: ${row.id}`);
      const review=this.db.prepare('SELECT * FROM brief_snapshot_reviews WHERE brief_id=?').get(row.id);
      if(row.status!==(review?.decision||'pending_review'))throw Error(`Brief snapshot status mismatch: ${row.id}`);
      if(review){
        const reviewClaim={id:review.id,briefId:row.id,reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at};
        const entry=this.db.prepare("SELECT * FROM audit WHERE action='brief_snapshot.reviewed' AND entity_id=?").get(row.id);
        if(!entry||entry.actor_id!==review.reviewer_id||entry.payload_hash!==hash(JSON.stringify(reviewClaim)))throw Error(`Brief snapshot review mismatch: ${row.id}`);
      }
      lastHashByCase.set(row.case_id,row.content_hash);sequenceByCase.set(row.case_id,row.sequence);
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
  caseAccessible(operator,id){if(!operator||!roles.has(operator.role))return false;const row=this.db.prepare('SELECT created_by FROM cases WHERE id=?').get(id);if(!row)return false;if(row.created_by===operator.id)return true;if(operator.role!=='reviewer')return false;return !!this.db.prepare('SELECT 1 FROM case_reviewers cr JOIN operators o ON o.id=cr.reviewer_id WHERE cr.case_id=? AND cr.reviewer_id=? AND cr.revoked_at IS NULL AND o.disabled_at IS NULL').get(id,operator.id)}
  listCasesFor(operator){if(!operator||!roles.has(operator.role))throw Error('Unauthorized operator');return this.listCases().filter(row=>this.caseAccessible(operator,row.id))}
  listCaseReviewersFor(operator,caseId){this.verifyAudit();this.verifyRecords();if(!this.caseAccessible(operator,caseId))return null;return this.db.prepare('SELECT id,case_id,reviewer_id,assigned_by,rationale,created_at,revoked_at,revoked_by,revocation_rationale FROM case_reviewers WHERE case_id=? ORDER BY created_at DESC').all(caseId).map(row=>({id:row.id,caseId:row.case_id,reviewerId:row.reviewer_id,assignedBy:row.assigned_by,rationale:row.rationale,createdAt:row.created_at,revokedAt:row.revoked_at,revokedBy:row.revoked_by,revocationRationale:row.revocation_rationale}))}
  recordCaseRead(operator,caseId,action,resourceId=null){
    if(!caseReadActions.has(action)||resourceId!==null&&typeof resourceId!=='string')throw Error('Valid case read action required');
    return this.transaction(()=>{
      if(!this.caseAccessible(operator,caseId))throw Error('Case not found or not accessible');
      if(action==='brief_snapshot.viewed'&&this.db.prepare('SELECT case_id FROM brief_snapshots WHERE id=?').get(resourceId)?.case_id!==caseId)throw Error('Brief snapshot does not belong to case');
      const record={id:crypto.randomUUID(),caseId,operatorId:operator.id,action,resourceId,occurredAt:iso()};
      this.db.prepare('INSERT INTO case_access_log(id,case_id,operator_id,action,resource_id,occurred_at) VALUES(?,?,?,?,?,?)').run(record.id,caseId,operator.id,action,resourceId,record.occurredAt);
      this.audit(operator.id,'case.access',record.id,record);
      return record;
    });
  }
  recordCaseList(operator,caseIds){
    if(!Array.isArray(caseIds)||caseIds.some(id=>typeof id!=='string'))throw Error('Valid case list required');
    return this.transaction(()=>caseIds.map(caseId=>{
      if(!this.caseAccessible(operator,caseId))throw Error('Case not found or not accessible');
      const record={id:crypto.randomUUID(),caseId,operatorId:operator.id,action:'case.listed',resourceId:null,occurredAt:iso()};
      this.db.prepare('INSERT INTO case_access_log(id,case_id,operator_id,action,resource_id,occurred_at) VALUES(?,?,?,?,?,?)').run(record.id,caseId,operator.id,record.action,null,record.occurredAt);
      this.audit(operator.id,'case.access',record.id,record);
      return record;
    }));
  }
  listCaseAccessFor(operator,caseId){
    const owner=this.db.prepare('SELECT created_by FROM cases WHERE id=?').get(caseId);
    if(!owner||owner.created_by!==operator?.id)return null;
    this.recordCaseRead(operator,caseId,'case.access_log_viewed');
    return this.db.prepare('SELECT id,case_id,operator_id,action,resource_id,occurred_at FROM case_access_log WHERE case_id=? ORDER BY occurred_at DESC,id DESC LIMIT 500').all(caseId).map(row=>({id:row.id,caseId:row.case_id,operatorId:row.operator_id,action:row.action,resourceId:row.resource_id,occurredAt:row.occurred_at}));
  }
  assignCaseReviewer(operator,caseId,reviewerId,rationale){
    if(!validText(rationale,20,2000))throw Error('Assignment rationale of 20–2000 characters required');
    return this.transaction(()=>{const owner=this.db.prepare('SELECT created_by FROM cases WHERE id=?').get(caseId);if(!owner||owner.created_by!==operator?.id)throw Error('Case owner required');const reviewer=this.db.prepare('SELECT role,disabled_at FROM operators WHERE id=?').get(reviewerId);if(!reviewer||reviewer.role!=='reviewer'||reviewer.disabled_at||reviewerId===operator.id)throw Error('Active distinct reviewer required');if(this.db.prepare('SELECT 1 FROM case_reviewers WHERE case_id=? AND reviewer_id=? AND revoked_at IS NULL').get(caseId,reviewerId))throw Error('Reviewer already assigned');const record={id:crypto.randomUUID(),caseId,reviewerId,assignedBy:operator.id,rationale:rationale.trim(),createdAt:iso()};this.db.prepare('INSERT INTO case_reviewers(id,case_id,reviewer_id,assigned_by,rationale,created_at) VALUES(?,?,?,?,?,?)').run(record.id,caseId,reviewerId,operator.id,record.rationale,record.createdAt);this.audit(operator.id,'case_reviewer.assigned',record.id,record);return record});
  }
  revokeCaseReviewer(operator,assignmentId,rationale){
    if(!validText(rationale,20,2000))throw Error('Revocation rationale of 20–2000 characters required');
    return this.transaction(()=>{const row=this.db.prepare('SELECT * FROM case_reviewers WHERE id=?').get(assignmentId);const owner=row&&this.db.prepare('SELECT created_by FROM cases WHERE id=?').get(row.case_id);if(!row||owner?.created_by!==operator?.id)throw Error('Case owner required');if(row.revoked_at)throw Error('Reviewer assignment already revoked');const record={id:row.id,caseId:row.case_id,reviewerId:row.reviewer_id,revokedBy:operator.id,revokedAt:iso(),rationale:rationale.trim()};this.db.prepare('UPDATE case_reviewers SET revoked_at=?,revoked_by=?,revocation_rationale=? WHERE id=?').run(record.revokedAt,operator.id,record.rationale,row.id);this.audit(operator.id,'case_reviewer.revoked',row.id,record);return record});
  }
  getCaseFor(operator,id){if(!this.caseAccessible(operator,id))return null;return this.getCase(id)}
  getPersonScopesFor(operator,id){if(!this.caseAccessible(operator,id))return null;return this.getPersonScopes(id)}
  recordBriefRequest(operator,id){return this.transaction(()=>{if(!this.caseAccessible(operator,id))throw Error('Case not found or not accessible');this.audit(operator.id,'case.brief_requested',id,{caseId:id});const row=this.db.prepare('SELECT occurred_at,entry_hash FROM audit ORDER BY seq DESC LIMIT 1').get();return {generatedAt:row.occurred_at,auditHead:row.entry_hash}})}
  listBriefSnapshotsFor(operator,caseId){this.verifyAudit();this.verifyRecords();if(!this.caseAccessible(operator,caseId))return null;return this.db.prepare('SELECT id,case_id,sequence,content_hash,previous_hash,status,created_by,created_at FROM brief_snapshots WHERE case_id=? ORDER BY sequence DESC').all(caseId).map(row=>{const review=this.db.prepare('SELECT reviewer_id,decision,rationale,created_at FROM brief_snapshot_reviews WHERE brief_id=?').get(row.id);return {id:row.id,caseId:row.case_id,sequence:row.sequence,contentHash:row.content_hash,previousHash:row.previous_hash,status:row.status,createdBy:row.created_by,createdAt:row.created_at,review:review?{reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at}:null}})}
  getBriefSnapshotFor(operator,id){this.verifyAudit();this.verifyRecords();const row=this.db.prepare('SELECT * FROM brief_snapshots WHERE id=?').get(id);if(!row||!this.caseAccessible(operator,row.case_id))return null;const review=this.db.prepare('SELECT reviewer_id,decision,rationale,created_at FROM brief_snapshot_reviews WHERE brief_id=?').get(id);return {id:row.id,caseId:row.case_id,sequence:row.sequence,contentHash:row.content_hash,previousHash:row.previous_hash,status:row.status,createdBy:row.created_by,createdAt:row.created_at,review:review?{reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at}:null,brief:JSON.parse(row.content_json)}}
  getLatestBriefSnapshotFor(operator,caseId){const items=this.listBriefSnapshotsFor(operator,caseId);return items?.length?this.getBriefSnapshotFor(operator,items[0].id):null}
  saveBriefSnapshot(operator,caseId,brief){
    if(!operator||!roles.has(operator.role))throw Error('Unauthorized operator');
    const contentJson=JSON.stringify(brief);
    if(brief?.schema!=='event-atlas.internal-event-case-brief.v1'||brief.case?.id!==caseId||brief.generatedBy!==operator.id||!validTime(brief.generatedAt)||typeof contentJson!=='string'||Buffer.byteLength(contentJson)>1000000)throw Error('Valid bounded case brief required');
    return this.transaction(()=>{if(!this.caseAccessible(operator,caseId))throw Error('Case not found or not accessible');if(brief.localAuditHead!==this.verifyAudit())throw Error('Brief audit reference is no longer current');const previous=this.db.prepare('SELECT sequence,content_hash FROM brief_snapshots WHERE case_id=? ORDER BY sequence DESC LIMIT 1').get(caseId);const record={id:crypto.randomUUID(),caseId,sequence:(previous?.sequence||0)+1,contentHash:hash(contentJson),previousHash:previous?.content_hash||'0'.repeat(64),status:'pending_review',createdBy:operator.id,createdAt:iso()};this.db.prepare('INSERT INTO brief_snapshots(id,case_id,sequence,content_json,content_hash,previous_hash,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(record.id,caseId,record.sequence,contentJson,record.contentHash,record.previousHash,record.status,operator.id,record.createdAt);this.audit(operator.id,'brief_snapshot.created',record.id,record);return record});
  }
  reviewBriefSnapshot(operator,id,decision,rationale){
    if(operator?.role!=='reviewer')throw Error('Reviewer role required');
    if(!briefDecisions.has(decision)||!validText(rationale,20,2000))throw Error('Brief decision and rationale of 20–2000 characters required');
    return this.transaction(()=>{const row=this.db.prepare('SELECT id,case_id,sequence,created_by,status FROM brief_snapshots WHERE id=?').get(id);if(!row)throw Error('Brief snapshot not found');if(!this.caseAccessible(operator,row.case_id))throw Error('Reviewer not assigned to case');if(row.created_by===operator.id)throw Error('Creator cannot review own brief snapshot');if(row.status!=='pending_review')throw Error('Brief snapshot already reviewed');const latest=this.db.prepare('SELECT MAX(sequence) AS sequence FROM brief_snapshots WHERE case_id=?').get(row.case_id).sequence;if(latest!==row.sequence)throw Error('Superseded brief snapshot cannot be reviewed');const review={id:crypto.randomUUID(),briefId:id,reviewerId:operator.id,decision,rationale:rationale.trim(),createdAt:iso()};this.db.prepare('INSERT INTO brief_snapshot_reviews(id,brief_id,reviewer_id,decision,rationale,created_at) VALUES(?,?,?,?,?,?)').run(review.id,id,operator.id,decision,review.rationale,review.createdAt);this.db.prepare('UPDATE brief_snapshots SET status=? WHERE id=?').run(decision,id);this.audit(operator.id,'brief_snapshot.reviewed',id,review);return review});
  }
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
    return this.transaction(()=>{if(!this.caseAccessible(operator,caseId))throw Error('Case not found or not accessible');const record={...payload,id:crypto.randomUUID(),caseId,status:'pending_review',createdBy:operator.id,createdAt:iso()};this.db.prepare('INSERT INTO assessments(id,case_id,payload_json,status,created_by,created_at) VALUES(?,?,?,?,?,?)').run(record.id,caseId,JSON.stringify(payload),'pending_review',operator.id,record.createdAt);this.audit(operator.id,'assessment.created',record.id,record);return record});
  }
  reviewAssessment(operator,id,decision,rationale){
    if(operator?.role!=='reviewer')throw Error('Reviewer role required');
    if(!assessmentDecisions.has(decision)||!validText(rationale,20,2000))throw Error('Decision and rationale of 20–2000 characters required');
    return this.transaction(()=>{const assessment=this.db.prepare('SELECT id,case_id,created_by,status FROM assessments WHERE id=?').get(id);if(!assessment)throw Error('Assessment not found');if(!this.caseAccessible(operator,assessment.case_id))throw Error('Reviewer not assigned to case');if(assessment.created_by===operator.id)throw Error('Creator cannot review own assessment');if(assessment.status!=='pending_review')throw Error('Assessment already reviewed');const review={id:crypto.randomUUID(),assessmentId:id,reviewerId:operator.id,decision,rationale:rationale.trim(),createdAt:iso()};this.db.prepare('INSERT INTO assessment_reviews(id,assessment_id,reviewer_id,decision,rationale,created_at) VALUES(?,?,?,?,?,?)').run(review.id,id,operator.id,decision,review.rationale,review.createdAt);this.db.prepare('UPDATE assessments SET status=? WHERE id=?').run(decision,id);this.audit(operator.id,'assessment.reviewed',id,review);return review});
  }
  requestPersonScope(operator,caseId,input){
    if(!operator||!roles.has(operator.role))throw Error('Unauthorized operator');
    if(!protectiveRoles.has(input?.role)||!validText(input?.protectiveNexus,30,2000)||!validText(input?.lawfulAuthority,10,500)||!validText(input?.collectionPurpose,20,500)||!validTime(input?.expiresAt))throw Error('Scope requires a designated role, protective nexus, lawful authority, collection purpose, and expiry');
    const expiry=Date.parse(input.expiresAt),now=Date.now();
    if(expiry<=now||expiry>now+90*86400000)throw Error('Scope expiry must be in the next 90 days');
    const payload={role:input.role,protectiveNexus:input.protectiveNexus.trim(),lawfulAuthority:input.lawfulAuthority.trim(),collectionPurpose:input.collectionPurpose.trim(),expiresAt:new Date(expiry).toISOString()};
    return this.transaction(()=>{if(!this.caseAccessible(operator,caseId))throw Error('Case not found or not accessible');const caseRow=this.db.prepare('SELECT payload_json FROM cases WHERE id=?').get(caseId);if(JSON.parse(caseRow.payload_json).subject?.type!=='published_event')throw Error('Person scope requires a published event case');const record={...payload,id:crypto.randomUUID(),caseId,status:'pending_review',createdBy:operator.id,createdAt:iso()};this.db.prepare('INSERT INTO person_scopes(id,case_id,payload_json,status,created_by,created_at) VALUES(?,?,?,?,?,?)').run(record.id,caseId,JSON.stringify(payload),record.status,operator.id,record.createdAt);this.audit(operator.id,'person_scope.created',record.id,record);return record});
  }
  reviewPersonScope(operator,id,decision,rationale){
    if(operator?.role!=='reviewer')throw Error('Reviewer role required');
    if(!scopeDecisions.has(decision)||!validText(rationale,20,2000))throw Error('Scope decision and rationale of 20–2000 characters required');
    return this.transaction(()=>{const row=this.db.prepare('SELECT * FROM person_scopes WHERE id=?').get(id);if(!row)throw Error('Scope not found');if(!this.caseAccessible(operator,row.case_id))throw Error('Reviewer not assigned to case');if(row.created_by===operator.id)throw Error('Creator cannot review own scope');if(row.status!=='pending_review')throw Error('Scope already reviewed');if(Date.parse(JSON.parse(row.payload_json).expiresAt)<=Date.now())throw Error('Scope expired');const review={id:crypto.randomUUID(),scopeId:id,reviewerId:operator.id,decision,rationale:rationale.trim(),createdAt:iso()};this.db.prepare('INSERT INTO person_scope_reviews(id,scope_id,reviewer_id,decision,rationale,created_at) VALUES(?,?,?,?,?,?)').run(review.id,id,operator.id,decision,review.rationale,review.createdAt);this.db.prepare('UPDATE person_scopes SET status=? WHERE id=?').run(decision,id);this.audit(operator.id,'person_scope.reviewed',id,review);return review});
  }
  createProtectedPerson(operator,scopeId,input){
    if(!operator||!roles.has(operator.role))throw Error('Unauthorized operator');
    if(!validText(input?.displayName,2,200)||!validText(input?.professionalRole,3,200)||!validUrl(input?.designationSource?.url)||!validText(input?.designationSource?.authority,3,200)||!validTime(input?.designationSource?.observedAt)||!confidences.has(input?.identityConfidence)||!validText(input?.identityRationale,20,1000)||!validTime(input?.retentionUntil))throw Error('Person requires a sourced designation, professional role, identity-confidence rationale, and retention review date');
    if(!Array.isArray(input.publicProfessionalFacts)||input.publicProfessionalFacts.length<1||input.publicProfessionalFacts.length>10||input.publicProfessionalFacts.some(f=>!validText(f?.claim,10,500)||!validUrl(f?.sourceUrl)||!validTime(f?.observedAt)))throw Error('Person requires 1–10 cited public professional facts');
    return this.transaction(()=>{const scope=this.db.prepare('SELECT * FROM person_scopes WHERE id=?').get(scopeId);if(!scope||!this.caseAccessible(operator,scope.case_id))throw Error('Scope not found or not accessible');const scoped=JSON.parse(scope.payload_json);if(scope.status!=='approved'||Date.parse(scoped.expiresAt)<=Date.now())throw Error('Active approved scope required before named collection');if(input.role!==scoped.role)throw Error('Person role must match approved scope');const until=Date.parse(input.retentionUntil);if(until<=Date.now()||until>Date.parse(scoped.expiresAt))throw Error('Retention review date must be within active scope');const payload={displayName:input.displayName.trim(),role:input.role,professionalRole:input.professionalRole.trim(),designationSource:{url:new URL(input.designationSource.url).toString(),authority:input.designationSource.authority.trim(),observedAt:new Date(input.designationSource.observedAt).toISOString()},identityConfidence:input.identityConfidence,identityRationale:input.identityRationale.trim(),publicProfessionalFacts:input.publicProfessionalFacts.map(f=>({claim:f.claim.trim(),sourceUrl:new URL(f.sourceUrl).toString(),observedAt:new Date(f.observedAt).toISOString()})),retentionUntil:new Date(until).toISOString(),dissemination:'internal_only'};const record={...payload,id:crypto.randomUUID(),scopeId,status:'pending_review',createdBy:operator.id,createdAt:iso()};this.db.prepare('INSERT INTO protected_people(id,scope_id,payload_json,status,created_by,created_at) VALUES(?,?,?,?,?,?)').run(record.id,scopeId,JSON.stringify(payload),record.status,operator.id,record.createdAt);this.audit(operator.id,'protected_person.created',record.id,record);return record});
  }
  reviewProtectedPerson(operator,id,decision,rationale){
    if(operator?.role!=='reviewer')throw Error('Reviewer role required');
    if(!personDecisions.has(decision)||!validText(rationale,20,2000))throw Error('Person decision and rationale of 20–2000 characters required');
    return this.transaction(()=>{const row=this.db.prepare('SELECT * FROM protected_people WHERE id=?').get(id);if(!row)throw Error('Person not found');const reviewScope=this.db.prepare('SELECT case_id FROM person_scopes WHERE id=?').get(row.scope_id);if(!this.caseAccessible(operator,reviewScope.case_id))throw Error('Reviewer not assigned to case');if(row.created_by===operator.id)throw Error('Creator cannot review own person record');if(row.status!=='pending_review')throw Error('Person already reviewed');const scope=this.db.prepare('SELECT * FROM person_scopes WHERE id=?').get(row.scope_id);if(scope.status!=='approved'||Date.parse(JSON.parse(scope.payload_json).expiresAt)<=Date.now()||Date.parse(JSON.parse(row.payload_json).retentionUntil)<=Date.now())throw Error('Scope or retention review date expired');const review={id:crypto.randomUUID(),personId:id,reviewerId:operator.id,decision,rationale:rationale.trim(),createdAt:iso()};this.db.prepare('INSERT INTO protected_person_reviews(id,person_id,reviewer_id,decision,rationale,created_at) VALUES(?,?,?,?,?,?)').run(review.id,id,operator.id,decision,review.rationale,review.createdAt);this.db.prepare('UPDATE protected_people SET status=? WHERE id=?').run(decision,id);this.audit(operator.id,'protected_person.reviewed',id,review);return review});
  }
  getPersonScopes(caseId){this.verifyAudit();this.verifyRecords();return this.db.prepare('SELECT * FROM person_scopes WHERE case_id=? ORDER BY created_at DESC').all(caseId).map(row=>{const review=this.db.prepare('SELECT * FROM person_scope_reviews WHERE scope_id=?').get(row.id);const people=this.db.prepare('SELECT * FROM protected_people WHERE scope_id=? ORDER BY created_at DESC').all(row.id).map(p=>{const r=this.db.prepare('SELECT * FROM protected_person_reviews WHERE person_id=?').get(p.id);return {...JSON.parse(p.payload_json),id:p.id,scopeId:row.id,status:p.status,retentionReviewDue:Date.parse(JSON.parse(p.payload_json).retentionUntil)<=Date.now(),createdBy:p.created_by,createdAt:p.created_at,review:r?{reviewerId:r.reviewer_id,decision:r.decision,rationale:r.rationale,createdAt:r.created_at}:null}});return {...JSON.parse(row.payload_json),id:row.id,caseId,status:row.status,expired:Date.parse(JSON.parse(row.payload_json).expiresAt)<=Date.now(),createdBy:row.created_by,createdAt:row.created_at,review:review?{reviewerId:review.reviewer_id,decision:review.decision,rationale:review.rationale,createdAt:review.created_at}:null,people}})}
  auditSummary(){this.verifyAudit();this.verifyRecords();const row=this.db.prepare('SELECT seq,entry_hash FROM audit ORDER BY seq DESC LIMIT 1').get();return {entries:row?.seq||0,head:row?.entry_hash||'0'.repeat(64),verified:true}}
}
