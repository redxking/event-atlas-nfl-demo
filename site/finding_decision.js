// Conditional planning guidance; these fields do not assert observed impact.
export function findingDecision(cue){
 const domain=cue.domain;
 const common={basis:'Planning judgment; confirm the condition and its event relevance before acting.',review:'Review before the affected event activity; review promptly if the condition is already occurring.'};
 if(domain==='weather alert')return {...common,impact:'If the official alert covers an occupied event area during its validity window, outdoor attendees, staff and access operations may require protective measures.',owner:'Event safety lead with the local weather liaison',verify:'Check the current official alert, footprint, validity and publisher instructions against occupied event areas.',escalate:'The issuing authority’s instructions or the event’s approved weather plan require action for the confirmed area and period.',close:'The alert has expired or been cancelled and the event safety lead has checked residual conditions.'};
 if(domain==='weather forecast')return {...common,impact:'Forecast hazards may affect outdoor activity, drainage, access or staffing; the outlook does not establish an observed incident.',owner:'Event safety and operations leads',verify:'Compare the latest local forecast and warnings with the event period and the venue’s approved weather thresholds.',escalate:'A current warning, observed condition or approved planning threshold requires a change to operations.',close:'Updated forecasts and verified venue conditions no longer meet the planning threshold.'};
 if(domain==='transit access')return {...common,impact:'If affected service is used by attendees during arrival or departure, delays or suspension may shift demand to other routes or create queues.',owner:'Venue transport lead and transit operator',verify:'Confirm the affected line, stations, operating period and whether the service carries event attendees.',escalate:'The operator confirms an event-relevant disruption and the venue identifies insufficient alternative capacity or unsafe queues.',close:'The operator confirms restored service or an adequate alternative, and the venue checks that queues have cleared.'};
 if(['road access','regional road access','pregame access'].includes(domain))return {...common,impact:'If the listed segment serves an event route during its operating period, the condition may delay arrivals, departures or emergency access.',owner:'Venue transport lead with the road authority',verify:'Confirm that the record remains active, overlaps actual event travel and affects an approved attendee or emergency route.',escalate:'The road authority confirms an affected event route and the venue identifies inadequate diversion capacity or blocked emergency access.',close:'The condition ends or a verified diversion preserves event access and emergency passage.'};
 return {...common,impact:'The available record does not establish a specific operational consequence.',owner:'Event lead and the responsible source authority',verify:'Confirm what occurred, where, when and how it relates to this event.',escalate:'Corroborated evidence establishes an event-relevant hazard or explicit threat requiring a response under the event plan.',close:'The source corrects or withdraws the finding, or the event lead verifies resolution.'};
}

// Coordination groups share a venue and operational task, not a claim of common cause.
export function groupFindingDecisions(findings){
 const groups=new Map();
 findings.forEach((cue,index)=>{
  const family=['road access','regional road access','pregame access'].includes(cue.domain)?'road access':cue.domain||'other';
  for(const game of cue.games||[]){
   const key=JSON.stringify([game.venue.id,family]);
   if(!groups.has(key))groups.set(key,{title:({ 'road access':'Confirm event access routes','transit access':'Confirm attendee transport service','weather alert':'Review official weather protection instructions','weather forecast':'Review event weather thresholds'})[family]||'Verify reported event concern',venue:game.venue,games:[],findings:[],evidenceNumbers:[],...findingDecision(cue)});
   const group=groups.get(key);
   if(!group.games.some(g=>g.id===game.id))group.games.push(game);
   if(!group.findings.includes(cue)){group.findings.push(cue);group.evidenceNumbers.push(index+1);}
  }
 });
 return [...groups.values()].map(group=>({...group,finding:group.findings[0],verificationSteps:[...new Set(group.findings.map(c=>c.action||group.verify))],interpretation:'Grouped for coordination at this venue. Separate records do not establish independent corroboration or a shared cause.'}));
}

// Analytical context; none of these fields asserts an observed venue impact.
export function findingAssessment(cue){
 const domain=cue.domain;
 const context=domain==='weather alert'||domain==='weather forecast'
 ?{operations:'Outdoor activities, attendee welfare, access and event staffing',openQuestion:'Does the current hazard footprint cover occupied event areas during the activity period, and which approved weather threshold applies?',alternative:'The forecast or alert may be superseded, outside occupied event areas, or outside the actual activity period.'}
 :domain==='transit access'
 ?{operations:'Attendee arrival and departure, station queues and transport capacity',openQuestion:'Is this added service or a disruption, which event passengers use it, and is alternative capacity sufficient?',alternative:'The notice may describe added service or a station attendees do not use; a published change is not necessarily a disruption.'}
 :['road access','regional road access','pregame access'].includes(domain)
 ?{operations:'Attendee and emergency access, arrival routes and departure routes',openQuestion:'Which approved attendee or emergency route uses the affected segment during event travel, and what diversion capacity is available?',alternative:'The notice may describe planned work, an unaffected route, or a period when event traffic is absent; active closure and venue impact remain unverified.'}
 :{operations:'Event operations; the affected function is not established',alternative:'The record may be unrelated, outdated or describe a routine condition; event relevance needs confirmation.'};
 return {...context,confidence:'The record is linked to its stated publisher. Independent verification of source accuracy and current venue impact is not supplied in this briefing.',openQuestion:context.openQuestion||'Does the current source condition affect an actual event operation, at the reported place and time?',...findingDecision(cue)};
}
