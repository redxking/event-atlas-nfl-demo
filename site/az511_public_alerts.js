export const az511PublicAlertsUrl='https://az511.gov/List/Alerts';
const DAY=86400000;
const phoenixDate=value=>new Date(Date.parse(value)-7*3600000).toISOString().slice(0,10);

export function selectAz511PublicAlerts(game,snapshot,now=Date.now()){
  const empty={state:'outside_near_term_arizona_scope',asOf:null,sourceUrl:az511PublicAlertsUrl,totalListed:0,entries:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.venue?.id!=='3970'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*DAY)return empty;
  const checkedAt=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.az511-public-alerts.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==az511PublicAlertsUrl||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>2*3600000||!Array.isArray(snapshot.entries)||snapshot.entries.length>20)return {...empty,state:'stale_or_unavailable'};
  const valid=item=>{
    const updated=Date.parse(item?.updatedAt);
    return typeof item.title==='string'&&item.title.length>=3&&item.title.length<=180&&typeof item.notes==='string'&&item.notes.length>=10&&item.notes.length<=2000&&Number.isFinite(updated)&&updated<=checkedAt+5*60000&&item.sourceUrl===az511PublicAlertsUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'')&&(!item.localDateStart&&!item.localDateEnd||/^\d{4}-\d{2}-\d{2}$/.test(item.localDateStart||'')&&/^\d{4}-\d{2}-\d{2}$/.test(item.localDateEnd||'')&&item.localDateStart<=item.localDateEnd);
  };
  if(!snapshot.entries.every(valid))return {...empty,state:'stale_or_unavailable'};
  const date=phoenixDate(game.kickoff);
  const entries=snapshot.entries.filter(item=>item.localDateStart&&item.localDateStart<=date&&date<=item.localDateEnd&&/Phoenix|Glendale|Agua Fria|Loop 101|L-101/i.test(item.title+' '+item.notes)).map(item=>({title:item.title,notes:item.notes,updatedAt:item.updatedAt,localDateStart:item.localDateStart,localDateEnd:item.localDateEnd,sourceTextSha256:item.sourceTextSha256,sourceUrl:item.sourceUrl,regionalCorridorMention:/Agua Fria|Loop 101|L-101/i.test(item.notes)}));
  return {...empty,state:entries.length?'current_date_matched_regional_notice':'current_page_checked_no_date_match',asOf:snapshot.checkedAt,totalListed:snapshot.entries.length,entries,interpretation:snapshot.interpretation};
}
