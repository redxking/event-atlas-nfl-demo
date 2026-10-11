const HOUR=3600000;
const MINUTE=60000;

export function selectWeatherContext(game,features,retrievedAt,now=Date.now()){
  const kickoff=Date.parse(game.kickoff);
  const feedFresh=Number.isFinite(retrievedAt)&&retrievedAt<=now+MINUTE&&now-retrievedAt<=5*MINUTE;
  const gameReady=!game.timeTbd&&Number.isFinite(kickoff)&&kickoff+5*HOUR>=now&&
    !/cancel/i.test(game.status||'');
  const windowStart=kickoff-4*HOUR,windowEnd=kickoff+5*HOUR;
  const alerts=(Array.isArray(features)?features:[]).map(feature=>{
    const p=feature?.properties||{};
    const starts=Date.parse(p.effective);
    const ends=Date.parse(p.ends||p.expires);
    const validWindow=Number.isFinite(starts)&&Number.isFinite(ends)&&ends>=starts;
    const sourceValid=(!p.status||p.status==='Actual')&&!/^cancel/i.test(p.messageType||'');
    const candidate=feedFresh&&gameReady&&sourceValid&&validWindow&&
      ['Severe','Extreme'].includes(p.severity)&&['Immediate','Expected'].includes(p.urgency)&&
      starts<=windowEnd&&ends>=windowStart&&ends>now;
    return {feature,candidate,validWindow};
  }).sort((a,b)=>Number(b.candidate)-Number(a.candidate));
  const state=!feedFresh?'stale':!gameReady?'kickoff_unavailable':'screened';
  return {state,candidateCount:alerts.filter(item=>item.candidate).length,alerts:alerts.slice(0,5)};
}
