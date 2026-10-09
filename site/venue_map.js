export function projectVenue(lat,lon){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<24||lat>50||lon< -126||lon> -65)return null;
  return {x:Math.round((lon+126)*10000/61)/10,y:Math.round((50-lat)*5700/26)/10};
}

export function venueMarkers(rows,games,now=Date.now()){
  const byVenue=new Map();
  for(const game of games){
    const id=game.venue.id;
    if(!byVenue.has(id))byVenue.set(id,[]);
    byVenue.get(id).push(game);
  }
  return rows.flatMap(row=>{
    const point=projectVenue(row.lat,row.lon);
    if(!point)return [];
    const schedule=(byVenue.get(row.id)||[]).slice().sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
    const game=schedule.find(item=>Date.parse(item.kickoff)>=now)||schedule.at(-1);
    const camera=row.camera==='connected',road=row.road==='connected';
    const state=camera&&road?'both':camera?'camera':road?'road':
      row.camera==='source_failed'||row.road==='source_failed'?'failed':
      ['stale','unavailable'].includes(row.camera)||['stale','unavailable'].includes(row.road)?'unknown':'none';
    return [{...row,...point,state,gameId:game?.id||null,gameTitle:game?.title||null}];
  });
}
