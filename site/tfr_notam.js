const months={January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11};
const unescape=value=>value.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'");
const plain=value=>unescape(String(value||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const utcDate=value=>{
  const match=/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4}) at (\d{2})(\d{2}) UTC$/.exec(value);
  if(!match)return null;
  const at=Date.UTC(Number(match[3]),months[match[1]],Number(match[2]),Number(match[4]),Number(match[5]));
  const date=new Date(at);
  if(date.getUTCFullYear()!==Number(match[3])||date.getUTCMonth()!==months[match[1]]||date.getUTCDate()!==Number(match[2])||date.getUTCHours()!==Number(match[4])||date.getUTCMinutes()!==Number(match[5]))return null;
  return date.toISOString();
};
const regexEscape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function parseTfrNotam(notamId,response){
  if(!/^\d+\/\d{4}$/.test(notamId)||!Array.isArray(response)||response.length!==1||response[0]?.notam_id!==notamId||typeof response[0].text!=='string'||response[0].text.length>250000)throw Error('FAA NOTAM detail mismatch');
  const sourceText=plain(response[0].text);
  const between=(start,end)=>sourceText.match(new RegExp(`${start}\\s*:\\s*(.*?)\\s+${end}\\s*:`,'i'))?.[1]?.trim()||null;
  const beginning=between('Beginning Date and Time','Ending Date and Time');
  const ending=between('Ending Date and Time','Reason for NOTAM');
  const type=between('Type','Replaced NOTAM\\(s\\)');
  const rawReason=between('Reason for NOTAM','Type');
  const reason=String(type||'').toLowerCase()==='vip'?'VIP movement restriction':rawReason?.slice(0,180)||null;
  const occurrences=(sourceText.match(/Effective Date\(s\):/g)||[]).length;
  let windowState='complex_or_unverified',startAt=null,endAt=null;
  if(beginning==='Effective Immediately'&&ending==='Permanent')windowState='standing_permanent';
  else if(occurrences===1){
    const start=utcDate(beginning||''),end=utcDate(ending||'');
    const effectiveMatches=start&&end&&new RegExp(`Effective Date\\(s\\): From ${regexEscape(beginning)}(?: \\([^)]*\\))? To ${regexEscape(ending)}`).test(sourceText);
    if(effectiveMatches&&Date.parse(end)>Date.parse(start)){windowState='single_explicit_utc_window';startAt=start;endAt=end}
  }
  return {detailStatus:'retrieved',windowState,startAt,endAt,reason,notamType:type?.slice(0,80)||null};
}

export function tfrAtKickoff(game,notice){
  if(notice?.windowState==='standing_permanent')return 'standing_airspace_context';
  if(notice?.windowState!=='single_explicit_utc_window')return 'time_unverified';
  if(game?.timeTbd||!Number.isFinite(Date.parse(game?.kickoff)))return 'kickoff_unverified';
  const kickoff=Date.parse(game.kickoff);
  return Date.parse(notice.startAt)<=kickoff&&kickoff<Date.parse(notice.endAt)?'listed_kickoff_within_notam_window':'listed_kickoff_outside_notam_window';
}
