export const martaAlertSource='https://itsmarta.com/';
export const martaAlertPage='https://itsmarta.com/ride/alerts';

export function selectMartaAlertPreview(game,snapshot,now=Date.now()){
  const empty={state:'outside_source_event',asOf:null,sourceUrl:martaAlertSource,alertPageUrl:martaAlertPage,alerts:[],listedCount:null};
  if(game?.id!=='nfl:401872993'||game?.venue?.id!=='5348'||game?.timeTbd||!String(game?.kickoff||'').startsWith('2026-10-12'))return empty;
  const at=Date.parse(snapshot?.retrievedAt);
  if(snapshot?.schema!=='event-atlas.marta-alert-preview.v1'||snapshot.status!=='ok'||snapshot.sourceUrl!==martaAlertSource||snapshot.alertPageUrl!==martaAlertPage||snapshot.sourceCategory!=='Train Alerts'||snapshot.previewLimited!==true||!Number.isSafeInteger(snapshot.listedCount)||snapshot.listedCount<0||snapshot.listedCount>99||!Array.isArray(snapshot.alerts)||snapshot.alerts.length>5||!Number.isFinite(at)||at>now+60000||now-at>2*3600000)return {...empty,state:'stale_or_unavailable'};
  const alerts=snapshot.alerts.filter(item=>/^[a-f0-9]{16}$/.test(item?.id||'')&&typeof item.detail==='string'&&item.detail.length<=500&&item.sourceUrl===martaAlertPage&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'')&&Number.isFinite(Date.parse(item.expiresAt))&&Date.parse(item.expiresAt)>at);
  if(alerts.length!==snapshot.alerts.length||new Set(alerts.map(item=>item.id)).size!==alerts.length)return {...empty,state:'stale_or_unavailable'};
  const windowStart=Date.parse(game.kickoff)-4*3600000;
  const annotated=alerts.map(item=>({...item,activeAtView:Date.parse(item.expiresAt)>now,expiryExtendsIntoEventWindow:Date.parse(item.expiresAt)>windowStart}));
  return {state:'current_preview',asOf:snapshot.retrievedAt,sourceUrl:martaAlertSource,alertPageUrl:martaAlertPage,listedCount:snapshot.listedCount,alerts:annotated,windowCandidateCount:annotated.filter(item=>item.activeAtView&&item.expiryExtendsIntoEventWindow).length,interpretation:snapshot.interpretation};
}
