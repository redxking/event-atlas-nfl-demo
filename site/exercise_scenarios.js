export const EXERCISE_SCHEMA='event-atlas.synthetic-exercise.v1';
export const EXERCISE_MODE='synthetic_exercise';

const isText=(value,max=500)=>typeof value==='string'&&value.length>0&&value.length<=max;
const validTime=value=>isText(value,50)&&Number.isFinite(Date.parse(value));
const allMode=(items)=>items.every(item=>item?.dataMode===EXERCISE_MODE);

export function validateExerciseCatalog(catalog){
  if(catalog?.schema!==EXERCISE_SCHEMA||catalog.dataMode!==EXERCISE_MODE||!isText(catalog.banner,300)||!isText(catalog.seed,100)||!validTime(catalog.clock)||!Array.isArray(catalog.sourceCatalog)||catalog.sourceCatalog.length<6||catalog.sourceCatalog.length>30||!Array.isArray(catalog.scenarios)||catalog.scenarios.length<3||catalog.scenarios.length>12)throw Error('Invalid exercise catalog');
  if(!allMode(catalog.sourceCatalog)||new Set(catalog.sourceCatalog.map(item=>item.id)).size!==catalog.sourceCatalog.length||catalog.sourceCatalog.some(item=>!/^sx-[a-z0-9-]+$/.test(item.id)||!isText(item.name,100)||!item.name.startsWith('Fictional')||!isText(item.kind,80)))throw Error('Invalid fictional source catalog');
  const sourceIds=new Set(catalog.sourceCatalog.map(item=>item.id));
  if(!allMode(catalog.scenarios)||new Set(catalog.scenarios.map(item=>item.id)).size!==catalog.scenarios.length)throw Error('Invalid exercise scenarios');
  for(const scenario of catalog.scenarios){
    if(!/^sx-[a-z0-9-]+$/.test(scenario.id)||!isText(scenario.title,120)||!isText(scenario.place,160)||!scenario.place.startsWith('Fictional')||!validTime(scenario.localStart)||!Array.isArray(scenario.observations)||scenario.observations.length<2||scenario.observations.length>50||!allMode(scenario.observations)||!scenario.candidate||scenario.candidate.dataMode!==EXERCISE_MODE||!scenario.report||scenario.report.dataMode!==EXERCISE_MODE||!isText(scenario.report.abstract,1200))throw Error(`Invalid exercise scenario ${scenario.id}`);
    const ids=new Set(scenario.observations.map(item=>item.id));
    if(ids.size!==scenario.observations.length||scenario.observations.some(item=>!/^sx-[a-z0-9-]+$/.test(item.id)||!sourceIds.has(item.sourceId)||!validTime(item.observedAt)||!isText(item.claim,500)||!isText(item.kind,80)))throw Error(`Invalid exercise observations ${scenario.id}`);
    for(const list of [scenario.candidate.supportingIds,scenario.candidate.contradictingIds||[],scenario.candidate.excludedIds||[],scenario.candidate.excludedAsIndependentCorroboration||[],scenario.report.claimIds]){
      if(!Array.isArray(list)||list.some(id=>!ids.has(id))||new Set(list).size!==list.length)throw Error(`Invalid exercise evidence references ${scenario.id}`);
    }
    if(scenario.protectedPerson&&(scenario.protectedPerson.dataMode!==EXERCISE_MODE||!isText(scenario.protectedPerson.fictionalName,100)||!isText(scenario.protectedPerson.designation,100)))throw Error(`Invalid fictional person ${scenario.id}`);
    if(scenario.rejectedCandidate&&(scenario.rejectedCandidate.dataMode!==EXERCISE_MODE||!Array.isArray(scenario.rejectedCandidate.supportingIds)||!Array.isArray(scenario.rejectedCandidate.contradictingIds)||[...scenario.rejectedCandidate.supportingIds,...scenario.rejectedCandidate.contradictingIds].some(id=>!ids.has(id))))throw Error(`Invalid rejected exercise candidate ${scenario.id}`);
    if(scenario.map&&(scenario.map.dataMode!==EXERCISE_MODE||scenario.map.precision!=='exercise geometry; not an actual venue'))throw Error(`Invalid exercise geometry ${scenario.id}`);
    if(scenario.organizer||scenario.promoter||scenario.permits||scenario.areaHistory||scenario.agencyPicture){
      if(!scenario.organizer||!scenario.promoter||!Array.isArray(scenario.permits)||!scenario.areaHistory||!scenario.agencyPicture||!allMode([scenario.organizer,scenario.promoter,...scenario.permits,scenario.areaHistory,scenario.agencyPicture]))throw Error(`Invalid event planning record ${scenario.id}`);
      if(!isText(scenario.organizer.name,120)||!isText(scenario.promoter.name,120)||!scenario.organizer.name.startsWith('Fictional')||!scenario.promoter.name.startsWith('Fictional')||!scenario.permits.every(item=>sourceIds.has(item.sourceId)&&isText(item.type,80)&&isText(item.state,80))||!sourceIds.has(scenario.areaHistory.sourceId)||!Number.isSafeInteger(scenario.areaHistory.comparableEvents)||!Number.isSafeInteger(scenario.areaHistory.violentIncidentReports)||scenario.areaHistory.violentIncidentReports>scenario.areaHistory.comparableEvents||!Number.isSafeInteger(scenario.attendance?.permitCap)||scenario.attendance.permitCap<1||scenario.agencyPicture.resourceNeed?.state!=='proposed_not_sent')throw Error(`Invalid event planning details ${scenario.id}`);
      for(const id of ['sx-p1','sx-p2','sx-p3','sx-p4'])if(!ids.has(id))throw Error(`Missing event planning evidence ${scenario.id}`);
    }
  }
  return catalog;
}

export function exerciseFrame(catalog,scenarioId,revealed=0,area='base'){
  validateExerciseCatalog(catalog);
  const scenario=catalog.scenarios.find(item=>item.id===scenarioId);
  if(!scenario)throw Error('Unknown exercise scenario');
  if(!Number.isSafeInteger(revealed)||revealed<0||revealed>scenario.observations.length||!['base','expanded'].includes(area))throw Error('Invalid exercise step');
  const observations=scenario.observations.slice(0,revealed);
  const visibleIds=new Set(observations.map(item=>item.id));
  const candidateReady=scenario.candidate.supportingIds.every(id=>visibleIds.has(id));
  const contradictory=(scenario.candidate.contradictingIds||[]).filter(id=>visibleIds.has(id));
  const excluded=[...(scenario.candidate.excludedIds||[]),...(scenario.candidate.excludedAsIndependentCorroboration||[])].filter(id=>visibleIds.has(id));
  const sourceStates=catalog.sourceCatalog.map(source=>({...source,state:observations.some(item=>item.sourceId===source.id&&item.kind==='source_outage')?'simulated_unavailable':source.state}));
  const planning=scenario.organizer?{organizer:visibleIds.has('sx-p1')?scenario.organizer:null,promoter:visibleIds.has('sx-p3')?scenario.promoter:null,attendance:visibleIds.has('sx-p1')?scenario.attendance:null,permits:visibleIds.has('sx-p1')?scenario.permits:null,areaHistory:visibleIds.has('sx-p2')?scenario.areaHistory:null,agencyPicture:visibleIds.has('sx-p4')?scenario.agencyPicture:null}:null;
  return {schema:EXERCISE_SCHEMA,dataMode:EXERCISE_MODE,banner:catalog.banner,seed:catalog.seed,clock:catalog.clock,scenario:{id:scenario.id,title:scenario.title,place:scenario.place,jurisdictionPath:scenario.jurisdictionPath,localStart:scenario.localStart,lifecycle:scenario.lifecycle,protectedPerson:scenario.protectedPerson||null,attendance:scenario.organizer?null:scenario.attendance||null},planning,area,geometry:scenario.map?{precision:scenario.map.precision,editState:'preview_only',reason:scenario.map.editReason,polygon:area==='expanded'?scenario.map.expandedArea:scenario.map.monitoringArea,candidatePoint:scenario.map.candidatePoint}:null,step:revealed,totalSteps:scenario.observations.length,observations,candidate:candidateReady?{...scenario.candidate,visibleContradictingIds:contradictory,visibleExcludedIds:excluded,reviewState:revealed===scenario.observations.length?'all_scripted_evidence_visible':'incomplete_scripted_evidence'}:null,rejectedCandidate:revealed===scenario.observations.length?scenario.rejectedCandidate||null:null,report:revealed===scenario.observations.length?scenario.report:null,sourceStates,useLimit:catalog.useLimit};
}
