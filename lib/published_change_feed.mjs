import {createHash} from 'node:crypto';

const base='https://redxking.github.io/event-atlas-nfl-demo/';
const validTime=value=>Number.isFinite(Date.parse(value));
const https=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}};
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const bounded=(value,max)=>String(value??'').slice(0,max);

export function buildPublishedChangeFeed(reports,states,now=Date.now()){
  const byId=new Map((reports||[]).map(report=>[report.eventId,report]));
  const seen=new Set(),items=[];
  for(const state of states||[]){
    const report=byId.get(state?.eventId);
    if(!report||state?.schema!=='event-atlas.published-report-state.v5'||!Array.isArray(state.changes))continue;
    const reportUrl=new URL(report.path,base).href;
    for(const change of state.changes.slice(0,30)){
      const time=Date.parse(change?.observedAt);
      if(!Number.isFinite(time)||time>now+60000||now-time>14*86400000||!https(change.sourceUrl))continue;
      const title=bounded(change.title,300),detail=bounded(change.detail,1500),kind=bounded(change.kind,40);
      if(!title||!kind)continue;
      const id=createHash('sha256').update(JSON.stringify([state.eventId,change.observedAt,kind,title,change.sourceUrl])).digest('hex');
      if(seen.has(id))continue;
      seen.add(id);
      items.push({id,eventId:state.eventId,eventTitle:bounded(report.title,300),kind,title,detail,observedAt:new Date(time).toISOString(),reportUrl,sourceUrl:https(change.sourceUrl),status:'unreviewed_source_change'});
    }
  }
  items.sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)||a.id.localeCompare(b.id));
  return {schema:'event-atlas.published-change-feed.v1',status:'unreviewed_public_source_changes',builtAt:new Date(now).toISOString(),basis:'Bounded changes observed between comparable hourly public-source samples for near-term NFL games. Source changes are not verified incidents, venue impacts, threats, or an all-clear.',items:items.slice(0,100)};
}

export function renderPublishedChangeAtom(feed){
  if(feed?.schema!=='event-atlas.published-change-feed.v1')throw Error('Published change feed required');
  const entries=feed.items.map(item=>`  <entry>\n    <id>urn:sha256:${xml(item.id)}</id>\n    <title>${xml(item.eventTitle)}: ${xml(item.title)}</title>\n    <updated>${xml(item.observedAt)}</updated>\n    <link rel="alternate" href="${xml(item.reportUrl)}"/>\n    <link rel="related" href="${xml(item.sourceUrl)}"/>\n    <category term="${xml(item.kind)}"/>\n    <summary>${xml(item.detail)} Unreviewed source change; confirm the publisher record and event relevance.</summary>\n  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <id>${base}reports/changes.xml</id>\n  <title>Event Atlas NFL public-source changes</title>\n  <subtitle>${xml(feed.basis)}</subtitle>\n  <updated>${xml(feed.builtAt)}</updated>\n  <link rel="self" href="${base}reports/changes.xml"/>\n  <link rel="alternate" href="${base}"/>\n${entries}${entries?'\n':''}</feed>\n`;
}
