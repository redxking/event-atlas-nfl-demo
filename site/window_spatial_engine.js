export function distanceMeters(a,b){const rad=Math.PI/180,x=(b.lat-a.lat)*rad,y=(b.lon-a.lon)*rad,h=Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))}
export function makeMonitoringArea(venue,change={},previous=null){
 const area={schema:'event-atlas.exercise-area.v1',dataMode:'synthetic_exercise',venueId:venue.id,lat:change.lat??venue.lat,lon:change.lon??venue.lon,radiusM:change.radiusM??600,revision:(previous?.revision||0)+1,basis:'Operator exercise circle; not an official stadium perimeter or legal geofence'};
 if(![area.lat,area.lon,area.radiusM].every(Number.isFinite)||Math.abs(area.lat)>85||Math.abs(area.lon)>180||area.radiusM<100||area.radiusM>3000||distanceMeters(venue,area)>10000)throw Error('Use a radius of 100–3000 m and a center within 10 km of the venue candidate.');
 return area;
}
const offsets={'S-01':[250,150],'S-02':[270,160],'S-03':[250,160],'S-10':[450,100],'S-11':[-120,90],'S-13':[300,80],'S-17':[1300,-200],'S-18':[850,450],'S-20':[-300,-100],'S-22':[1500,600],'S-23':[2200,1500],'S-25':[950,-150]};
export function withSpatialContext(brief,venue,area){
 if(brief.dataMode!=='synthetic_exercise'||area.dataMode!=='synthetic_exercise'||area.venueId!==venue.id||String(brief.event.venue.id)!==String(venue.id))throw Error('Cross-venue or live spatial context');
 makeMonitoringArea(venue,area);
 const features=brief.observations.filter(r=>offsets[r.recordId]).map(r=>{const [east,north]=offsets[r.recordId],point={lat:venue.lat+north/111195,lon:venue.lon+east/(111195*Math.cos(venue.lat*Math.PI/180))};const distanceM=Math.round(distanceMeters(point,area));return {evidenceId:r.evidenceId,recordId:r.recordId,dataMode:'synthetic_exercise',positionBasis:'Fictional offset from unreviewed venue point',...point,distanceM,withinArea:distanceM<=area.radiusM}});
 return {...brief,venuePoint:{...venue,reviewState:'unreviewed_candidate'},monitoringArea:area,spatialContext:{features,inside:features.filter(f=>f.withinArea).length,outside:features.filter(f=>!f.withinArea).length,limitation:'Spatial inclusion is exercise context only; it does not establish threat, identity or operational impact.'}};
}
