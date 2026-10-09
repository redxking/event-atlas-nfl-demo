const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));

export function buildInternalCaseBrief(detail,{generatedAt=new Date().toISOString(),generatedBy,auditHead,publicSituation=null}={}){
  const record=detail.case;
  if(record?.subject?.type!=='published_event')throw Error('Internal event brief requires a published event case');
  if(!generatedBy||!auditHead)throw Error('Brief generation requires operator and local audit reference');
  const assessments=detail.assessments||[],scopes=detail.personScopes||[];
  const accepted=assessments.filter(item=>item.status==='accepted_for_internal_review'&&item.review);
  const activeScopes=scopes.filter(scope=>scope.status==='approved'&&!scope.expired&&Date.parse(scope.expiresAt)>Date.parse(generatedAt));
  const people=activeScopes.flatMap(scope=>scope.people.filter(person=>person.status==='approved'&&!person.retentionReviewDue&&Date.parse(person.retentionUntil)>Date.parse(generatedAt)).map(person=>({id:person.id,scopeId:scope.id,role:person.role,displayName:person.displayName,professionalRole:person.professionalRole,designationSource:person.designationSource,identityConfidence:person.identityConfidence,identityRationale:person.identityRationale,publicProfessionalFacts:person.publicProfessionalFacts,retentionReviewAt:person.retentionUntil,approvedBy:person.review.reviewerId,approvedAt:person.review.createdAt})));
  const gaps=[];
  if(!accepted.length)gaps.push('No independently reviewed analyst assessment is available for this case.');
  if(!people.length)gaps.push('No active, reviewed protected-person designation is available for this case.');
  if(detail.sourceDrift?.status!=='unchanged_since_intake')gaps.push('The current local event source differs from intake, is stale, is missing, or has no comparison baseline; reconcile before action.');
  if(!publicSituation)gaps.push('Current public conditions were unavailable for this generated brief.');
  gaps.push('Operator-approved ground perimeter, gate plan, camera field of view, attendance, security and medical posture, and credentialed drone-detection reports are not established by this case record.');
  gaps.push('No agency dissemination approval, recipient list, or operational protective notification is recorded.');
  return {
    schema:'event-atlas.internal-event-case-brief.v1',
    status:'draft_internal_review_only',
    generatedAt,generatedBy,
    localAuditHead:auditHead,
    useLimit:'Reviewable local case synthesis. Assessment acceptance authorizes internal review only; this artifact is not a verified threat finding, operational order, or approval to disseminate.',
    case:{id:record.id,createdAt:record.createdAt,createdBy:record.createdBy,authority:record.authority,protectivePurpose:record.purpose,openingRationale:record.openingRationale},
    event:pick(record.subject,['id','title','sourceId','sourceUrl','retrievedAt','startsAtLocal','placeId','sourceStatus','connectorStatus','operationalSnapshot']),
    sourceComparison:detail.sourceDrift||null,
    publicSituation,
    reviewedAssessments:accepted.map(item=>({id:item.id,createdAt:item.createdAt,createdBy:item.createdBy,severity:item.severity,confidence:item.confidence,analysis:item.analysis,confidenceRationale:item.confidenceRationale,impact:item.impact,alternativeExplanations:item.alternativeExplanations,protectiveNexus:item.protectiveNexus,recommendation:item.recommendation,limitations:item.limitations,evidence:item.evidence,review:item.review,interpretation:'Analyst proposal accepted for internal review; cited source claims are not independently verified by this application.'})),
    pendingReview:{assessments:assessments.filter(item=>item.status==='pending_review').length,returnedAssessments:assessments.filter(item=>item.status==='returned_for_correction').length,personScopes:scopes.filter(scope=>scope.status==='pending_review').length,personRecords:scopes.flatMap(scope=>scope.people).filter(person=>person.status==='pending_review').length},
    protectedPeople:people,
    overallJudgment:{severity:'not_synthesized',confidence:'not_synthesized',reason:'Case assessments may differ; an accountable reviewer must make and approve an event-level judgment.'},
    changesSincePreviousBrief:'unavailable_no_persisted_brief_baseline',
    gaps
  };
}
