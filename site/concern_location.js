// Only publisher-supplied points are eligible. Missing coordinates never fall back to the venue.
export function sourcePoint(value){
 const lat=value?.lat,lon=value?.lon;
 return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;
}
export function concernIdentity(cue){
 return JSON.stringify([cue.sourceUrl,cue.sourceId?['record',String(cue.sourceId)]:['finding',cue.trigger,cue.sourceAt]]);
}
export function locatedConcerns(items){
 const unique=new Map();
 for(const cue of items||[]){const point=sourcePoint(cue.location);if(cue.status!=='unreviewed_source_cue'||!point)continue;
  try{if(new URL(cue.sourceUrl).protocol!=='https:')continue;}catch{continue;}
  unique.set(concernIdentity(cue),{...cue,location:point});
 }
 return [...unique.values()];
}
