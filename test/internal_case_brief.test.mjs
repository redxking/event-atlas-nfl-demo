import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInternalCaseBrief} from '../lib/build_internal_case_brief.mjs';

test('draft brief carries only reviewed claims and active approved designations',()=>{
  const generatedAt='2026-10-09T20:00:00.000Z';
  const evidence=[{url:'https://example.org/notice',observedAt:generatedAt,claim:'Synthetic sourced notice.',classification:'official_notice'}];
  const detail={case:{id:'case-1',createdAt:generatedAt,createdBy:'analyst',authority:'Synthetic agency',purpose:'Protective event review',openingRationale:'Synthetic source',subject:{type:'published_event',id:'game-1',title:'Synthetic game',sourceUrl:'https://example.org/game',retrievedAt:generatedAt}},sourceDrift:{status:'unchanged_since_intake'},assessments:[{id:'accepted',status:'accepted_for_internal_review',severity:'review_candidate',confidence:'low',analysis:'Synthetic assessment',evidence,review:{reviewerId:'reviewer',createdAt:generatedAt}},{id:'pending',status:'pending_review',severity:'urgent_concern',analysis:'Unreviewed claim',evidence}],personScopes:[{id:'scope-1',status:'approved',expired:false,expiresAt:'2026-10-10T20:00:00.000Z',people:[{id:'person-1',status:'approved',retentionReviewDue:false,retentionUntil:'2026-10-10T00:00:00.000Z',displayName:'Jordan Example',role:'team_official',professionalRole:'Synthetic official',designationSource:{url:'https://example.org/person'},identityConfidence:'moderate',identityRationale:'Synthetic match',publicProfessionalFacts:[],review:{reviewerId:'reviewer',createdAt:generatedAt}},{id:'person-2',status:'pending_review',retentionUntil:'2026-10-10T00:00:00.000Z',displayName:'Unreviewed Example'}]},{id:'scope-2',status:'approved',expired:true,expiresAt:'2026-10-08T20:00:00.000Z',people:[{id:'person-3',status:'approved',displayName:'Expired Example'}]}]};
  const brief=buildInternalCaseBrief(detail,{generatedAt,generatedBy:'analyst',auditHead:'a'.repeat(64),publicSituation:{kind:'event_situation_brief'}});
  assert.equal(brief.status,'draft_internal_review_only');
  assert.deepEqual(brief.reviewedAssessments.map(item=>item.id),['accepted']);
  assert.deepEqual(brief.protectedPeople.map(item=>item.id),['person-1']);
  assert.equal(brief.pendingReview.assessments,1);
  assert.equal(brief.pendingReview.personRecords,1);
  assert.equal(brief.overallJudgment.severity,'not_synthesized');
  assert.equal(brief.reviewedAssessments[0].evidence[0].url,evidence[0].url);
  assert.equal(JSON.stringify(brief).includes('Unreviewed claim'),false);
  assert.equal(JSON.stringify(brief).includes('Unreviewed Example'),false);
  assert.equal(JSON.stringify(brief).includes('Expired Example'),false);
});

test('source drift and missing current context remain explicit gaps',()=>{
  const brief=buildInternalCaseBrief({case:{id:'case-1',subject:{type:'published_event',id:'game-1'}},assessments:[],personScopes:[],sourceDrift:{status:'changed_since_intake'}},{generatedBy:'analyst',auditHead:'b'.repeat(64)});
  assert.ok(brief.gaps.some(item=>item.includes('source differs')));
  assert.ok(brief.gaps.some(item=>item.includes('Current public conditions')));
  assert.equal(brief.reviewedAssessments.length,0);
  assert.throws(()=>buildInternalCaseBrief({case:{subject:{type:'voting_site'}}},{generatedBy:'analyst',auditHead:'b'.repeat(64)}),/published event case/);
});
