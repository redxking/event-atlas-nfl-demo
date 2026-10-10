export const greenBayAlertCenter='https://www.greenbaywi.gov/AlertCenter.aspx';
const HOUR=3600000;
const feeds={
  emergency:'https://www.greenbaywi.gov/RSSFeed.aspx?CID=Emergency-Alerts-11&ModID=63',
  police:'https://www.greenbaywi.gov/RSSFeed.aspx?CID=Police-Department-Alerts-12&ModID=63'
};
const safeAlert=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.greenbaywi.gov'&&url.pathname.toLowerCase()==='/alertcenter.aspx'&&url.href.length<=1200}catch{return false}};

export function selectGreenBayAlertsForGame(game,snapshot,now=Date.now()){
  if(game?.venue?.id!=='3798')return {state:'outside_source_city',asOf:null,sourceUrl:greenBayAlertCenter,sources:[],alerts:[]};
  const built=Date.parse(snapshot?.builtAt);
  if(snapshot?.schema!=='event-atlas.green-bay-alerts.v1'||!Array.isArray(snapshot.sources)||snapshot.sources.length!==2||!Number.isFinite(built)||built>now+60000||now-built>2*HOUR)return {state:'stale_or_unavailable',asOf:null,sourceUrl:greenBayAlertCenter,sources:[],alerts:[]};
  const sources=Object.entries(feeds).map(([kind,url])=>{
    const source=snapshot.sources.find(item=>item?.kind===kind),sourceBuilt=Date.parse(source?.sourceBuiltAt);
    const current=source?.status==='ok'&&source.sourceUrl===url&&Array.isArray(source.alerts)&&source.alerts.length<=40&&Number.isFinite(sourceBuilt)&&sourceBuilt<=now+2*HOUR&&now-sourceBuilt<=12*HOUR;
    const alerts=current?source.alerts.filter(item=>item?.kind===kind&&typeof item.title==='string'&&item.title.length>0&&item.title.length<=200&&typeof item.detail==='string'&&item.detail.length<=600&&safeAlert(item.url)&&(!item.publishedAt||Number.isFinite(Date.parse(item.publishedAt))&&Date.parse(item.publishedAt)<=now+2*HOUR)):[];
    return {kind,state:current&&alerts.length===source.alerts.length?'current_snapshot':'unavailable',sourceUrl:url,sourceBuiltAt:current?source.sourceBuiltAt:null,publisherClockAhead:current&&sourceBuilt>now+5*60000,alerts};
  });
  const current=sources.filter(item=>item.state==='current_snapshot');
  return {state:current.length===2?'current_snapshot':current.length?'partial':'stale_or_unavailable',asOf:current.length?snapshot.builtAt:null,sourceUrl:greenBayAlertCenter,sources:sources.map(({kind,state,sourceUrl,sourceBuiltAt,publisherClockAhead})=>({kind,state,sourceUrl,sourceBuiltAt,publisherClockAhead})),alerts:current.flatMap(item=>item.alerts).slice(0,20),interpretation:snapshot.interpretation};
}
