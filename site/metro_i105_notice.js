export const METRO_I105_LIST_URL='https://cloud.sfmc.metro.net/I105_weekend_closures';
export const METRO_I105_DETAIL_URL='https://cloud.sfmc.metro.net/LaneClosures_CentralAv_to_I110';
const HOUR=3600000;
const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const losAngelesDate=value=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function parseMetroI105Notice(listHtml,detailHtml,checkedAt=new Date().toISOString()){
  if(typeof listHtml!=='string'||typeof detailHtml!=='string'||listHtml.length>250000||detailHtml.length>250000||!Number.isFinite(Date.parse(checkedAt)))throw Error('Invalid Metro work notice');
  const list=plain(listHtml),detail=plain(detailHtml);
  if(!/October 10-11, 2026/.test(list)||!listHtml.includes('LaneClosures_CentralAv_to_I110')||
     !/Westbound I-105 from Central Av to I-110: Friday, October 9 at 10pm through Sunday, October 11 at 10am/i.test(detail)||
     !/Center lanes including the HOV and #1 lane will be closed on westbound I-105/i.test(detail)||
     !/Other westbound travel lanes will remain open to traffic/i.test(detail)||
     !/Metro C Line bus bridge will be in place from Friday, October 9 at 9pm through Saturday, October 10 at 9am/i.test(detail))throw Error('Metro work notice changed or unavailable');
  return {
    status:'ok',checkedAt:new Date(checkedAt).toISOString(),listUrl:METRO_I105_LIST_URL,sourceUrl:METRO_I105_DETAIL_URL,
    publicationBasis:'2026 year on Metro notice index; local work hours on linked Metro detail',
    timezone:'America/Los_Angeles',route:'Westbound I-105 from Central Avenue to I-110',
    closureStart:'2026-10-10T05:00:00.000Z',closureEnd:'2026-10-11T17:00:00.000Z',
    cLineBridgeStart:'2026-10-10T04:00:00.000Z',cLineBridgeEnd:'2026-10-10T16:00:00.000Z',
    lanes:'HOV and number 1 lanes; other westbound travel lanes listed open',operationState:'anticipated work; not observed active'
  };
}

export function selectMetroI105Notice(game,snapshot,now=Date.now()){
  if(game?.venue?.id!=='7065'||!Number.isFinite(Date.parse(game?.kickoff)))return {state:'outside_source_event'};
  const kickoff=Date.parse(game.kickoff),start=Date.parse(snapshot?.closureStart),end=Date.parse(snapshot?.closureEnd),checked=Date.parse(snapshot?.checkedAt);
  if(losAngelesDate(kickoff)!=='2026-10-11')return {state:'outside_source_event'};
  if(snapshot?.status!=='ok'||snapshot.sourceUrl!==METRO_I105_DETAIL_URL||snapshot.listUrl!==METRO_I105_LIST_URL||!Number.isFinite(checked)||checked>now+60000||now-checked>12*HOUR||start!==Date.parse('2026-10-10T05:00:00Z')||end!==Date.parse('2026-10-11T17:00:00Z'))return {state:'unavailable',sourceUrl:METRO_I105_DETAIL_URL};
  if(game.timeTbd||/cancel|postpon|delay/i.test(game.status||''))return {state:'kickoff_unverified',sourceUrl:snapshot.sourceUrl,checkedAt:snapshot.checkedAt};
  const reviewStart=kickoff-4*HOUR,reviewEnd=kickoff+5*HOUR;
  const overlapMinutes=Math.max(0,Math.round((Math.min(end,reviewEnd)-Math.max(start,reviewStart))/60000));
  return {state:overlapMinutes?'pregame_window_overlap':'outside_review_window',sourceUrl:snapshot.sourceUrl,listUrl:snapshot.listUrl,checkedAt:snapshot.checkedAt,publicationBasis:snapshot.publicationBasis,timezone:snapshot.timezone,route:snapshot.route,closureStart:snapshot.closureStart,closureEnd:snapshot.closureEnd,cLineBridgeStart:snapshot.cLineBridgeStart,cLineBridgeEnd:snapshot.cLineBridgeEnd,lanes:snapshot.lanes,operationState:snapshot.operationState,reviewStart:new Date(reviewStart).toISOString(),reviewEnd:new Date(reviewEnd).toISOString(),overlapMinutes,endsBeforeKickoffMinutes:Math.round((kickoff-end)/60000)};
}
