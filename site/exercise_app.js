import {validateExerciseCatalog,exerciseFrame} from './exercise_scenarios.js?v=20261010-3';

const $=id=>document.getElementById(id);
const node=(tag,text,parent,cls)=>{const element=document.createElement(tag);element.textContent=text;if(cls)element.className=cls;parent.append(element);return element};
const fmt=value=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not supplied';
let catalog,scenarioId,revealed=0,area='base',callBranch='normal',playTimer=null;

function stopPlayback(){if(playTimer){clearInterval(playTimer);playTimer=null}}
function addDetail(list,label,value){node('dt',label,list);node('dd',value,list)}
function renderGeometry(geometry){
  const card=$('geometry-card');card.hidden=!geometry;if(!geometry)return;
  const svg=$('area-map');svg.replaceChildren();
  const ring=geometry.polygon?.coordinates?.[0]||[];
  const coords=[...ring,geometry.candidatePoint].filter(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite));
  if(coords.length<4)return;
  const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const px=x=>25+270*(x-minX)/(maxX-minX||1),py=y=>195-170*(y-minY)/(maxY-minY||1);
  const polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon');polygon.setAttribute('points',ring.map(p=>`${px(p[0])},${py(p[1])}`).join(' '));polygon.setAttribute('fill','#dce7e8');polygon.setAttribute('stroke','#1d5a75');polygon.setAttribute('stroke-width','3');svg.append(polygon);
  const point=document.createElementNS('http://www.w3.org/2000/svg','circle');point.setAttribute('cx',String(px(geometry.candidatePoint[0])));point.setAttribute('cy',String(py(geometry.candidatePoint[1])));point.setAttribute('r','6');point.setAttribute('fill','#b84b32');svg.append(point);
  $('area-note').textContent=`${area==='expanded'?'Expanded preview':'Base exercise area'} · ${geometry.precision}. ${geometry.reason||'No edit reason supplied'}. This is a preview only; no operational area was saved.`;
  $('area-toggle').textContent=area==='base'?'Preview expanded area':'Show base area';
}

function renderPlanning(planning){
  const card=$('planning-card'),body=$('planning-details');
  card.hidden=!planning;
  body.replaceChildren();
  if(!planning)return;
  if(planning.organizer){
    node('h4','Organizer and capacity · sx-p1',body);
    node('p',`${planning.organizer.name} is the fictional permit applicant and organizer. Permit cap: ${planning.attendance.permitCap.toLocaleString()}; organizer estimate: ${planning.attendance.value.toLocaleString()} (${planning.attendance.method}). Observed attendance: ${planning.attendance.observed===null?'unknown':planning.attendance.observed.toLocaleString()}.`,body);
    for(const permit of planning.permits)node('p',`${permit.type.replaceAll('_',' ')}: ${permit.state.replaceAll('_',' ')} · ${permit.authority} · ${permit.sourceId}${permit.verifiedAt?` · record ${fmt(permit.verifiedAt)}`:' · no verified record time'}.`,body,'planning-detail');
  }
  if(planning.areaHistory){
    const history=planning.areaHistory;
    node('h4','Historical context · sx-p2',body);
    node('p',`${history.violentIncidentReports} reports among ${history.comparableEvents} comparable fictional events during ${history.period}. ${history.comparableDefinition}. Geocoding: ${history.geocodeQuality}; coverage gap: ${history.coverageGap}. Outcomes and exposure hours are unavailable. ${history.interpretation}.`,body);
  }
  if(planning.promoter){
    node('h4','Promoter and RSVPs · sx-p3',body);
    node('p',`${planning.promoter.name} is identified as the fictional promoter by the organizer. The fixture records ${planning.promoter.priorEventCount} prior events (${planning.promoter.priorEventCountBasis}); this does not verify current attendance.`,body);
  }
  if(planning.agencyPicture){
    const agency=planning.agencyPicture;
    node('h4','Agency awareness · sx-p4',body);
    node('p',`Owner: ${agency.owner}. Local police: ${agency.localPoliceAwareness}. County EOC: ${agency.countyEocAwareness}. Federal partners: ${agency.federalPartnerAwareness}.`,body);
    node('p',`Possible ${agency.resourceNeed.capability}: ${agency.resourceNeed.state.replaceAll('_',' ')}. ${agency.resourceNeed.rationale}. No request or notification was sent.`,body,'planning-detail');
  }
  if(!body.children.length)node('p','Planning details appear when their fictional source records are revealed.',body,'empty');
}

function renderCall(call){
  const card=$('call-card');card.hidden=!call;if(!call)return;
  const summary=$('call-summary'),timeline=$('call-timeline'),receipts=$('call-receipts'),recent=$('call-recent'),followUp=$('call-follow-up');
  for(const element of [summary,timeline,receipts,recent,followUp])element.replaceChildren();
  $('call-state').textContent=call.branch==='lost_link'?'simulated link lost':call.followUp?'corrected field location':call.streamState||call.cadPriority||'awaiting call record';
  if(call.record)node('p',`${call.record.id} · ${call.record.reportedType.replaceAll('_',' ')} reported ${fmt(call.record.receivedAt)}. Location: ${call.record.locationPrecision}. Caller identity ${call.record.callerIdentity}. The report is unconfirmed.`,summary);
  if(call.cadPriority)node('p',`Fictional CAD ${call.cadPriority.replaceAll('_',' ')} created ${fmt(call.cadCreatedAt)}. Priority was assigned by a fictional dispatcher, not by this application.`,summary);
  if(call.drone)node('p',`Mission ${call.drone.missionId}: ${call.drone.authorityState.replaceAll('_',' ')}. Requested ${fmt(call.drone.requestedAt)}; launched ${fmt(call.drone.launchedAt)}. First usable view ${fmt(call.drone.firstUsableViewAt)}; ${call.drone.cameraPrecision}.`,summary);
  if(call.lostLinkMessage)node('p',call.lostLinkMessage,summary,'call-warning');
  const branchButton=$('call-branch');branchButton.hidden=!call.streamState;branchButton.textContent=call.branch==='lost_link'?'Resume scripted main path':'Replay lost-link branch';
  if(call.timeline.length){
    node('h4','Scripted source timeline',timeline,'call-subhead');
    for(const item of call.timeline)node('p',`${fmt(item.at)} · ${item.state==='field_corroborated'?'field report received':item.state.replaceAll('_',' ')} · ${item.claimId}.`,timeline,'call-line');
  }
  if(call.deliveryReceipts.length){
    node('h4','Simulated delivery receipts',receipts,'call-subhead');
    for(const item of call.deliveryReceipts)node('p',`Brief v${item.briefVersion} to ${item.recipient}: sent ${fmt(item.sentAt)}, received ${fmt(item.receivedAt)}. No real dispatch transmission occurred.`,receipts,'call-line');
  }
  if(call.recentActivity){
    node('h4','Case-scoped activity lookup',recent,'call-subhead');
    for(const item of call.recentActivity.matchResults)node('p',`${item.claimId} · ${item.matchType.replaceAll('_',' ')} · eligible for fictional prearrival brief: ${item.eligibleForPreArrivalBrief}.`,recent,'call-line');
    node('p',`Federal gateway: ${call.recentActivity.federalGatewayState.replaceAll('_',' ')}. No federal record result is implied.`,recent,'call-line');
  }
  if(call.followUp){
    node('h4','Later corrected field finding and case workup',followUp,'call-subhead');
    node('p',`Corrected incident basis ${call.followUp.incidentBasisClaimId}; fictional case ${call.followUp.caseId} opened ${fmt(call.followUp.openedAt)}. ${call.followUp.subject.name} appears only after fictional field identification.`,followUp,'call-warning');
    node('p',`Federal source: ${call.followUp.federalSource.state.replaceAll('_',' ')}; ${call.followUp.federalSource.interpretation}. Same-name record ${call.followUp.correction.recordId} excluded: ${call.followUp.correction.reason}.`,followUp,'call-line');
    for(const product of call.followUp.products)node('p',`${product.id} · ${product.audience} · ${product.state.replaceAll('_',' ')} · claims ${product.claimIds.join(', ')}. ${product.text} No actual notice was sent.`,followUp,'call-line');
  }
}

function render(){
  const frame=exerciseFrame(catalog,scenarioId,revealed,area,callBranch);
  $('exercise-workspace').hidden=false;
  $('load-state').hidden=true;
  $('exercise-clock').textContent=`Scripted exercise clock: ${fmt(frame.clock)} · Seed ${frame.seed}`;
  const nav=$('scenario-nav');nav.replaceChildren();
  for(const scenario of catalog.scenarios){
    const button=node('button',scenario.title,nav);button.type='button';button.setAttribute('aria-current',String(scenario.id===scenarioId));button.onclick=()=>{stopPlayback();scenarioId=scenario.id;revealed=0;area='base';callBranch='normal';history.replaceState(null,'',`?scenario=${encodeURIComponent(scenarioId)}`);render()};
  }
  $('event-jurisdiction').textContent=Array.isArray(frame.scenario.jurisdictionPath)?frame.scenario.jurisdictionPath.join(' › '):String(frame.scenario.jurisdictionPath);
  $('event-title').textContent=frame.scenario.title;
  $('event-place').textContent=frame.scenario.place;
  $('event-state').textContent=frame.scenario.lifecycle.replaceAll('_',' ');
  $('event-start').textContent=`Scripted start ${fmt(frame.scenario.localStart)}`;
  $('step-label').textContent=`${frame.step} of ${frame.totalSteps} fictional records visible${callBranch==='lost_link'?' · lost-link branch':''}`;
  $('next').disabled=frame.step===frame.totalSteps||callBranch==='lost_link';
  $('play').disabled=callBranch==='lost_link';
  $('play').textContent=playTimer?'Pause playback':'Play exercise';
  renderGeometry(frame.geometry);
  renderPlanning(frame.planning);
  renderCall(frame.call);

  const candidate=frame.candidate;
  $('candidate-state').textContent=candidate?candidate.status.replaceAll('_',' '):'awaiting evidence';
  $('candidate-summary').textContent=candidate?candidate.summary:'Reveal the required source records to form a review candidate. No risk or threat has been assessed.';
  const details=$('candidate-details');details.replaceChildren();
  if(candidate){
    addDetail(details,'Fictional impact label',candidate.severity.replaceAll('_',' '));
    addDetail(details,'Evidence confidence label',candidate.confidence);
    addDetail(details,'Review state',candidate.reviewState.replaceAll('_',' '));
    addDetail(details,'Supporting IDs',candidate.supportingIds.join(', '));
    addDetail(details,'Contradicting IDs',candidate.visibleContradictingIds.join(', ')||'None revealed yet');
    addDetail(details,'Excluded IDs',candidate.visibleExcludedIds.join(', ')||'None revealed yet');
  }
  const evidence=$('candidate-evidence');evidence.replaceChildren();
  if(candidate){
    node('p',candidate.limitations.join(' '),evidence,'evidence-note');
    node('p',`Next verification: ${candidate.nextVerification}`,evidence,'evidence-note');
  }
  if(frame.rejectedCandidate){
    node('h4','Rejected false positive',evidence);
    node('p',`${frame.rejectedCandidate.id}: ${frame.rejectedCandidate.reason}`,evidence);
  }
  if(frame.scenario.protectedPerson){
    node('h4','Fictional protected-person designation',evidence);
    node('p',`${frame.scenario.protectedPerson.fictionalName} · ${frame.scenario.protectedPerson.designation} · attendance ${frame.scenario.protectedPerson.attendanceState}. This is a fictional exercise record, not a real person profile.`,evidence);
  }
  if(frame.scenario.attendance)node('p',`Fictional planning estimate: ${frame.scenario.attendance.value.toLocaleString()} attendees; ${frame.scenario.attendance.method}; verified: ${frame.scenario.attendance.verified}.`,evidence);

  $('record-count').textContent=String(frame.observations.length);
  const records=$('records');records.replaceChildren();
  if(!frame.observations.length)node('p','No fictional source record revealed yet.',records,'empty');
  for(const observation of frame.observations){
    const row=node('article','',records,'record');
    node('h4',`${observation.id} · ${observation.kind.replaceAll('_',' ')}`,row);
    node('p',observation.claim,row);
    node('span',`${observation.sourceId} · observed ${fmt(observation.observedAt)} · ${observation.freshness} · ${observation.reliability}`,row,'record-meta');
  }

  const scenario=catalog.scenarios.find(item=>item.id===scenarioId),used=new Set(scenario.observations.map(item=>item.sourceId));
  const sources=$('sources');sources.replaceChildren();
  for(const source of frame.sourceStates.filter(item=>used.has(item.id))){
    const row=node('div','',sources,'source-row');node('strong',source.name,row);node('small',`${source.kind.replaceAll('_',' ')} · ${source.state.replaceAll('_',' ')} · scripted cadence ${source.cadenceSeconds}s`,row);
  }

  const report=$('report');report.replaceChildren();
  $('report-state').textContent=frame.report?`v${frame.report.version} · ${frame.report.status.replaceAll('_',' ')}`:'not assembled';
  if(frame.report){
    node('p',frame.report.abstract,report,'report-abstract');
    if(frame.report.supersededBy)node('p',`This provisional version predates corrected field finding ${frame.report.supersededBy}. Review the later case workup above before using it.`,report,'call-warning');
    node('p',`Report ${frame.report.id} · ${frame.report.classification} · claims ${frame.report.claimIds.join(', ')} · evidence through ${fmt(frame.report.asOfAt)}. No real approval or dissemination occurred.`,report,'report-meta');
  }else node('p',frame.call?'The provisional brief appears after its cited call and field records. Later case workup is shown separately.':'The scripted report becomes available after every exercise record is revealed. It will cite only this fictional evidence set.',report,'empty');
}

$('reset').onclick=()=>{stopPlayback();revealed=0;area='base';callBranch='normal';render()};
$('next').onclick=()=>{if(callBranch==='normal'&&revealed<catalog.scenarios.find(item=>item.id===scenarioId).observations.length){revealed++;render()}};
$('play').onclick=()=>{
  if(playTimer){stopPlayback();render();return}
  const total=catalog.scenarios.find(item=>item.id===scenarioId).observations.length;
  if(revealed===total)revealed=0;
  playTimer=setInterval(()=>{revealed++;if(revealed>=total){revealed=total;stopPlayback()}render()},1800);render();
};
$('area-toggle').onclick=()=>{area=area==='base'?'expanded':'base';render()};
$('call-branch').onclick=()=>{stopPlayback();const scenario=catalog.scenarios.find(item=>item.id===scenarioId);const streamStep=scenario.observations.findIndex(item=>item.kind==='stream_state')+1;if(!scenario.call||!streamStep||revealed<streamStep)return;revealed=streamStep;callBranch=callBranch==='normal'?'lost_link':'normal';render()};
$('download').onclick=()=>{
  const frame=exerciseFrame(catalog,scenarioId,revealed,area,callBranch);
  const url=URL.createObjectURL(new Blob([JSON.stringify(frame,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`event-atlas-${scenarioId}-synthetic-step-${revealed}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};

try{
  const response=await fetch('exercise_scenarios.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  catalog=validateExerciseCatalog(await response.json());
  const requested=new URL(location.href).searchParams.get('scenario');
  scenarioId=catalog.scenarios.some(item=>item.id===requested)?requested:catalog.scenarios[0].id;
  render();
}catch(error){$('load-state').textContent=`Exercise unavailable: ${error.message}. The public NFL data has not been affected.`}
