export const houstonTranstarDirectory='https://traffic.houstontranstar.org/rss/rss_info.aspx';
const FEEDS={incidents:'https://traffic.houstontranstar.org/data/rss/incidents_rss.xml',lane_closures:'https://traffic.houstontranstar.org/data/rss/laneclosures_rss.xml'};
const HOUR=3600000;

export function selectHoustonTranstarRss(game,snapshot,now=Date.now()){
  const empty={state:'outside_houston_scope',asOf:null,feeds:[],entries:[],sourceUrl:houstonTranstarDirectory};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.venue?.id!=='3891'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-18*HOUR||kickoff>now+30*24*HOUR)return empty;
  const checked=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.houston-transtar-rss.v1'||!['ok','partial'].includes(snapshot?.status)||!Number.isFinite(checked)||checked>now+60000||now-checked>2*HOUR)return {...empty,state:'stale_or_unavailable'};
  const feeds=[];
  for(const [kind,url] of Object.entries(FEEDS)){
    const feed=snapshot.feeds?.[kind];
    if(feed?.sourceUrl!==url||!['ok','failed'].includes(feed.status))return {...empty,state:'stale_or_unavailable'};
    if(feed.status==='failed'){
      feeds.push({kind,state:'failed',asOf:null,totalListed:null,corridorListed:null,entries:[],sourceUrl:url});
      continue;
    }
    const sourceAt=Date.parse(feed.sourceAt);
    if(!Number.isFinite(sourceAt)||sourceAt>checked+60000||checked-sourceAt>30*60000||!Number.isSafeInteger(feed.totalListed)||feed.totalListed<0||feed.totalListed>500||!Number.isSafeInteger(feed.corridorListed)||feed.corridorListed<0||feed.corridorListed>feed.totalListed||!Array.isArray(feed.entries)||feed.entries.length>20)return {...empty,state:'stale_or_unavailable'};
    const valid=item=>typeof item.id==='string'&&/^[0-9]+_[A-Za-z ]{2,30}$/.test(item.id)&&typeof item.title==='string'&&item.title.length>0&&item.title.length<=220&&typeof item.description==='string'&&item.description.length>0&&item.description.length<=700&&item.sourceAt===feed.sourceAt&&item.sourceUrl===url&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'')&&/\b(?:IH[- ]?610 South Loop|SH[- ]?288|South Main St|Main Street)\b/i.test(item.title);
    if(!feed.entries.every(valid))return {...empty,state:'stale_or_unavailable'};
    feeds.push({kind,state:'current_corridor_text_sample',asOf:feed.sourceAt,totalListed:feed.totalListed,corridorListed:feed.corridorListed,entries:feed.entries,sourceUrl:url});
  }
  const entries=feeds.flatMap(feed=>feed.entries.map(item=>({...item,kind:feed.kind,statusText:item.id.split('_').slice(1).join('_')})));
  return {...empty,state:feeds.every(feed=>feed.state==='current_corridor_text_sample')?'current_corridor_text_sample':'partial_corridor_text_sample',asOf:snapshot.checkedAt,feeds,entries,interpretation:snapshot.interpretation};
}
