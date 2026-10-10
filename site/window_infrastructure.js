export const infrastructurePayload={kind:'synthetic_infrastructure',units:'meters_offset_from_unreviewed_venue',features:[
 {id:'EXERCISE-UTILITY-01',kind:'utility_corridor',label:'Fictional utility corridor',type:'LineString',points:[[-900,-500],[-100,-500],[500,-200]]},
 {id:'EXERCISE-MEDICAL-01',kind:'hospital_route',label:'Fictional hospital access route',type:'LineString',points:[[0,0],[300,-300],[1400,-300],[1900,-900]]},
 {id:'EXERCISE-TRANSIT-01',kind:'transit_hub',label:'Fictional transit hub',type:'Point',points:[[950,-150]]},
 {id:'EXERCISE-CHOKE-01',kind:'choke_point',label:'Fictional route choke point',type:'Point',points:[[300,-300]]},
 {id:'EXERCISE-WORK-01',kind:'construction_zone',label:'Fictional construction zone',type:'Polygon',points:[[1100,-400],[1450,-400],[1450,-100],[1100,-100],[1100,-400]]}
]};
export function validateInfrastructurePayload(payload){
 if(payload?.kind!==infrastructurePayload.kind||payload.units!==infrastructurePayload.units||!Array.isArray(payload.features)||payload.features.length!==5)throw Error('Invalid infrastructure payload');
 const ids=new Set();for(const f of payload.features){const expected=infrastructurePayload.features.find(x=>x.kind===f.kind);if(!expected||f.id!==expected.id||f.type!==expected.type||f.label!==expected.label||ids.has(f.id)||!Array.isArray(f.points)||f.points.length!==expected.points.length||f.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>5000)))throw Error('Invalid fictional infrastructure feature');ids.add(f.id);if(f.type==='Polygon'&&JSON.stringify(f.points[0])!==JSON.stringify(f.points.at(-1)))throw Error('Unclosed exercise polygon')}
}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
function insidePolygon(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
export function infrastructureContext(brief,venue,area){
 const record=brief.observations.find(r=>r.recordId==='S-17');if(!record)return [];
 validateInfrastructurePayload(record.payload);
 const cos=Math.cos(venue.lat*Math.PI/180),center=[(area.lon-venue.lon)*111195*cos,(area.lat-venue.lat)*111195];
 return record.payload.features.map(f=>{const distance=f.type==='Point'?Math.hypot(f.points[0][0]-center[0],f.points[0][1]-center[1]):f.type==='Polygon'&&insidePolygon(center,f.points)?0:Math.min(...f.points.slice(1).map((p,i)=>segmentDistance(center,f.points[i],p)));
 return {id:`${brief.event.id}:${f.id}`,kind:f.kind,label:f.label,dataMode:'synthetic_exercise',evidenceId:record.evidenceId,sourceState:brief.sources.find(s=>s.id===record.sourceId)?.state||'unknown',type:f.type,coordinates:f.points.map(([east,north])=>[venue.lat+north/111195,venue.lon+east/(111195*cos)]),intersectsExerciseArea:distance<=area.radiusM,distanceToAreaCenterM:Math.round(distance),geometryBasis:'Fictional offsets; local planar approximation. Not actual infrastructure, an approved route, or a surveyed boundary.'};});
}
