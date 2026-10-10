// Deterministic adapter payloads. No real sensor, agency record or person is represented.
export const supplementalFeeds=[
 {id:'feed-camera',domain:'Venue operations',name:'Camera frames and connection health',claim:'Synthetic training camera reports normal vehicle flow. The schematic is not a view of the real venue.',payload:{kind:'camera_frame',cameraId:'EXERCISE-CAM-01',frame:1,vehicles:4,scene:'schematic_training_only'}},
 {id:'feed-airspace',domain:'Geospatial and environment',name:'Airspace restriction bulletin',claim:'Synthetic exercise airspace notice defines a training restriction. This is not an FAA NOTAM or legal airspace determination.',payload:{kind:'airspace_notice',noticeId:'EXERCISE-AIR-01',status:'exercise_active',radiusKm:3}},
 {id:'feed-adsb',domain:'Geospatial and environment',name:'ADS-B track observations',claim:'Synthetic cooperative aircraft track transits the exercise display. Identity, authorization and any violation are not established.',payload:{kind:'adsb_track',trackId:'EXERCISE-TRACK-01',altitudeFt:6500,headingDegrees:90}},
 {id:'feed-environment',domain:'Geospatial and environment',name:'Environmental and seismic hazard bulletin',claim:'Synthetic environmental bulletin reports a regional seismic event. Venue damage and disruption are unverified.',payload:{kind:'environmental_bulletin',hazard:'seismic',magnitude:3.2,impact:'unknown'}},
 {id:'feed-history',domain:'Law enforcement and public safety',name:'Historical public-safety baseline',claim:'Synthetic baseline contains aggregated calls from four comparable event windows. Calls are not confirmed crimes or evidence of individual risk.',payload:{kind:'aggregate_baseline',comparableWindows:4,callCounts:[8,11,9,12],recordUnit:'calls_not_crimes'}},
 {id:'feed-transit',domain:'Geospatial and environment',name:'Transit vehicle and service updates',claim:'Synthetic shuttle service reports a ten-minute delay. The exercise route is fictional; the actual transport plan is unverified.',payload:{kind:'transit_update',routeId:'EXERCISE-SHUTTLE-01',delayMinutes:10}},
 {id:'feed-participant',domain:'OSINT and social signals',name:'Public participant-role announcement',claim:'Fictional event program announces guest role EXERCISE-GUEST-01. This is not a real person, attendance confirmation or protective designation.',payload:{kind:'participant_announcement',roleToken:'EXERCISE-GUEST-01',attendance:'unverified',fictional:true}}
];
export const supplementalCandidates=[
 {id:'C-06',title:'Camera and dispatch verification',evidence:['S-13','S-20'],basis:'A synthetic camera-health record and dispatch update are available for operator review. The schematic cannot confirm the bag disposition or show the real venue.',next:'Review the dispatch correction; obtain authorized real imagery before any real-world conclusion.'},
 {id:'C-07',title:'Airspace and track review',evidence:['S-18','S-21','S-22'],basis:'Synthetic RF, restriction and cooperative-track records share an exercise window. They do not establish that the tracks identify the same aircraft or prove an incursion.',next:'Have an authorized aviation operator reconcile sensor identity, time and applicable airspace rules.'},
 {id:'C-08',title:'Transport and environmental contingency',evidence:['S-17','S-23','S-25'],basis:'A synthetic road closure, shuttle delay and regional hazard bulletin coexist. Impact on the actual venue and approved routes remains unverified.',next:'Verify transport status and facility condition with the responsible operators.'}
];
export function validateSupplementalPayload(sourceId,payload){
 const spec=supplementalFeeds.find(s=>s.id===sourceId);if(!spec)return;
 // Adapter contract admits only the declared fictional schema and bounded values.
 if(!payload||payload.kind!==spec.payload.kind||Object.keys(payload).sort().join()!==Object.keys(spec.payload).sort().join())throw Error('Invalid supplemental schema');
 for(const [key,value] of Object.entries(spec.payload)){
  if(['frame','vehicles'].includes(key)){if(!Number.isSafeInteger(payload[key])||payload[key]<0||payload[key]>10000)throw Error('Invalid camera counter')}
  else if(JSON.stringify(payload[key])!==JSON.stringify(value))throw Error('Invalid fictional adapter payload');
 }
}
