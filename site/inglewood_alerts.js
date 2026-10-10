export const inglewoodAlertCenterUrl='https://www.cityofinglewood.org/AlertCenter.aspx';
const sources={
  traffic:'https://www.cityofinglewood.org/RSSFeed.aspx?CID=Traffic-Alert-10&ModID=63',
  police:'https://www.cityofinglewood.org/RSSFeed.aspx?CID=Police-8&ModID=63',
  emergency:'https://www.cityofinglewood.org/RSSFeed.aspx?CID=Emergency-Services-12&ModID=63'
};
const validLink=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.cityofinglewood.org'&&url.pathname.toLowerCase()==='/alertcenter.aspx'&&/^AID=\d{1,9}$/.test(url.search.slice(1))}catch{return false}};
const localDate=kickoff=>{
  const date=new Date(kickoff);
  if(!Number.isFinite(date.getTime()))return null;
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'2-digit',month:'numeric',day:'numeric'}).format(date);
};
const dateInTitle=title=>{const m=String(title||'').match(/\b(1[0-2]|0?[1-9])\/(3[01]|[12]?\d)\/(\d{2})\b/);return m?`${Number(m[1])}/${Number(m[2])}/${m[3]}`:null};

export function selectInglewoodAlerts(game,snapshot,now=Date.now()){
  if(game?.venue?.id!=='7065'||!['Los Angeles Rams','Los Angeles Chargers'].includes(game?.teams?.find(team=>team.role==='home')?.name))return {state:'outside_source_area'};
  const at=Date.parse(snapshot?.checkedAt),date=localDate(game.kickoff);
  if(snapshot?.schema!=='event-atlas.inglewood-alerts.v1'||snapshot.venueId!=='7065'||!['ok','partial'].includes(snapshot.status)||!date||!Number.isFinite(at)||at>now+60000||now-at>3*3600000)return {state:'unavailable',sourceUrl:inglewoodAlertCenterUrl};
  const categories={};
  for(const [name,url] of Object.entries(sources)){
    const source=snapshot.categories?.[name];
    if(!source){categories[name]={state:'unavailable',sourceUrl:url};continue}
    if(source.sourceUrl!==url||!Number.isInteger(source.listedCount)||source.listedCount<0||source.listedCount>50||!Array.isArray(source.entries)||source.entries.length>8||source.entries.some(item=>!Number.isInteger(item?.id)||!validLink(item.sourceUrl)||name==='traffic'&&(typeof item.title!=='string'||item.title.length>180||typeof item.description!=='string'||item.description.length>280)))return {state:'unavailable',sourceUrl:inglewoodAlertCenterUrl};
    categories[name]={state:'retrieved_listing',sourceUrl:url,sourceBuildText:source.sourceBuildText,listedCount:source.listedCount,entries:name==='traffic'?source.entries.map(item=>({...item,dateInTitle:dateInTitle(item.title),sameLocalDate:dateInTitle(item.title)===date})):source.entries.map(item=>({id:item.id,sourceUrl:item.sourceUrl}))};
  }
  return {state:Object.values(categories).every(item=>item.state==='retrieved_listing')?'current_city_listing':'partial_city_listing',asOf:snapshot.checkedAt,sourceUrl:inglewoodAlertCenterUrl,gameLocalDate:date,categories,interpretation:snapshot.interpretation};
}
