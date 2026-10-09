const km=(a,b,c,d)=>{
  const r=Math.PI/180;
  return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r);
};

export function summarizeArlingtonCalls(feed,venue,game,checkedAt=Date.now()){
  if(!Array.isArray(feed?.features)||feed.exceededTransferLimit||feed.features.length>=2000)throw Error('Incident response is incomplete');
  const kickoff=Date.parse(game.kickoff),windowStart=kickoff-4*3600000,windowEnd=kickoff+5*3600000;
  let nearby=0,windowCount=0,newestUpdate=0;
  for(const feature of feed.features){
    const [lon,lat]=feature.geometry?.coordinates||[];
    const callAt=Number(feature.properties?.CallDate),updatedAt=Number(feature.properties?.UpdatedDate);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(callAt)||callAt<checkedAt-12*3600000||callAt>checkedAt||km(venue.lat,venue.lon,lat,lon)>5)continue;
    nearby++;
    if(Number.isFinite(updatedAt)&&updatedAt<=checkedAt)newestUpdate=Math.max(newestUpdate,updatedAt);
    if(!game.timeTbd&&callAt>=windowStart&&callAt<=windowEnd)windowCount++;
  }
  return {nearby,windowCount,gameWindowCurrent:!game.timeTbd&&checkedAt>=windowStart&&checkedAt<=windowEnd,newestUpdate:newestUpdate||null};
}
