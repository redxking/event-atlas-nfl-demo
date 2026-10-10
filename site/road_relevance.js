const HOUR=3600000;

export function selectRoadContext(game,snapshot,now=Date.now()){
  const covered=Object.hasOwn(snapshot?.byVenue||{},game.venue.id);
  const records=covered?snapshot.byVenue[game.venue.id]:[];
  const builtAt=Date.parse(snapshot?.builtAt);
  const stale=!Number.isFinite(builtAt)||builtAt>now+HOUR||now-builtAt>12*HOUR;
  const kickoff=Date.parse(game.kickoff);
  const venueCoverage=snapshot?.timedCoverageByVenue?.[game.venue.id];
  const coverageStart=Date.parse(venueCoverage?.from||snapshot?.coverageFrom);
  const coverageEnd=Date.parse(venueCoverage?.through||snapshot?.coverageThrough);
  const canMatch=!stale&&!game.timeTbd&&!/^cancel/i.test(game.status||'')&&Number.isFinite(kickoff)&&kickoff+5*HOUR>=now&&
    Number.isFinite(coverageStart)&&Number.isFinite(coverageEnd)&&kickoff+5*HOUR>=coverageStart&&kickoff<=coverageEnd;
  const start=kickoff-4*HOUR,end=kickoff+5*HOUR;
  const ranked=records.map(record=>{
    const from=Date.parse(record.startAt),through=Date.parse(record.endAt);
    const timed=record.timingPolicy!=='source_listed_only'&&Number.isFinite(from)&&Number.isFinite(through)&&through>=from;
    const overlaps=canMatch&&timed&&from<=end&&through>=start;
    return {...record,timed,overlaps};
  }).sort((a,b)=>Number(b.overlaps)-Number(a.overlaps)||a.distanceKm-b.distanceKm||String(a.id).localeCompare(String(b.id)));
  let timingState='matched';
  if(!covered)timingState='no_coverage';
  else if(stale)timingState='stale';
  else if(/^cancel/i.test(game.status||''))timingState='cancelled';
  else if(game.timeTbd)timingState='kickoff_tbd';
  else if(!Number.isFinite(kickoff)||kickoff+5*HOUR<now)timingState='past_or_invalid';
  else if(venueCoverage?.sourceListedOnly)timingState='source_listed_only';
  else if(!canMatch)timingState='outside_window';
  return {timingState,overlapCount:ranked.filter(record=>record.overlaps).length,records:ranked.slice(0,8)};
}
