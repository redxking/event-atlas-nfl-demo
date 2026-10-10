const clip=(value,max)=>String(value??'').slice(0,max);
const https=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}};
const time=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const additional={denverEventPlan:'Denver venue plan',sofiVenueEvent:'SoFi venue event page',metroSofiPlan:'Metro SoFi service plan',metroI105Notice:'Metro I-105 work notice',chargersTheme:'Chargers game theme',inglewoodAlerts:'Inglewood city listings'};

export function sourceCoverageRow(bundle){
  if(bundle?.schema!=='event-atlas.public-evidence-bundle.v1'||bundle.status!=='unreviewed_public_source_export'||!/^nfl:\d+$/.test(bundle.event?.id||'')||!time(bundle.generatedAt))throw Error('Public evidence bundle required');
  const sources=(bundle.picture?.sources||[]).slice(0,80).map(item=>({name:clip(item.name,120),state:clip(item.state,160),reportedTime:time(item.asOf),detail:clip(item.detail,1000),sourceUrl:https(item.sourceUrl)}));
  for(const [key,name] of Object.entries(additional)){
    const item=bundle[key];if(!item||item.state?.startsWith('outside_source'))continue;
    sources.push({name,state:clip(item.state,160),reportedTime:time(item.checkedAt||item.asOf),detail:'Exact source selection retained in the event evidence download.',sourceUrl:https(item.sourceUrl)});
  }
  return {eventId:bundle.event.id,title:clip(bundle.event.title,250),kickoff:time(bundle.event.kickoff),venueId:clip(bundle.venue?.id,100),venueName:clip(bundle.venue?.name,200),generatedAt:bundle.generatedAt,monitoringMode:bundle.reportMonitoringMode,reportPath:`${bundle.event.id.replace(':','-')}.html`,sources,gaps:(bundle.picture?.gaps||[]).slice(0,80).map(item=>clip(item,1000))};
}

export function buildSourceCoverage(rows,now=Date.now()){
  const byVenue=new Map();
  const priority=row=>Date.parse(row.kickoff)>=now?Date.parse(row.kickoff)-now:1e15+now-Date.parse(row.kickoff);
  for(const row of rows){
    if(!row.venueId)continue;
    const previous=byVenue.get(row.venueId);
    if(!previous||priority(row)<priority(previous))byVenue.set(row.venueId,row);
  }
  return {schema:'event-atlas.source-coverage.v1',builtAt:new Date(now).toISOString(),reportCount:rows.length,selection:'Nearest upcoming published game for each represented venue; most recent published game when no upcoming game is present.',venues:[...byVenue.values()].sort((a,b)=>a.venueName.localeCompare(b.venueName))};
}

export function renderSourceCoverage(coverage){
  const link=(url,label)=>url?`<a href="${escape(url)}" rel="noopener noreferrer">${escape(label)}</a>`:'Source link unavailable';
  const venues=coverage.venues.map(row=>`<details><summary>${escape(row.venueName)} · ${escape(row.title)}</summary><p>${link(row.reportPath,'Open event report')} · ${escape(row.monitoringMode)} · report generated ${escape(row.generatedAt)}</p><div class="table-wrap"><table><thead><tr><th>Source</th><th>Reported state</th><th>Reported time</th><th>Scope and limitations</th></tr></thead><tbody>${row.sources.map(source=>`<tr><th>${link(source.sourceUrl,source.name)}</th><td>${escape(source.state)}</td><td>${escape(source.reportedTime||'Not supplied')}</td><td>${escape(source.detail)}</td></tr>`).join('')}</tbody></table></div><h3>Recorded coverage gaps</h3><ul>${row.gaps.map(gap=>`<li>${escape(gap)}</li>`).join('')||'<li>No gap text supplied; this does not establish complete coverage.</li>'}</ul></details>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="Angelis Pseftis"><meta name="creator" content="Angelis Pseftis"><title>NFL source coverage</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#101b29;color:#e9eef5;max-width:1200px;margin:auto;padding:28px}a{color:#80d5ed}h1{font-size:2rem}summary{cursor:pointer;font-weight:650;padding:16px}details{border:1px solid #526176;border-radius:8px;margin:14px 0;padding:0 16px}table{border-collapse:collapse;min-width:700px;width:100%}td,th{padding:12px;border-bottom:1px solid #526176;text-align:left;vertical-align:top}.table-wrap{overflow:auto}td:nth-child(3){min-width:180px}small{color:#bdc9d8}</style></head><body><nav><a href="../">Event Atlas</a> · <a href="source-coverage.json">Download coverage JSON</a> · <a href="changes.xml">Source-change feed</a></nav><h1>NFL source coverage</h1><p>${coverage.venues.length} represented venues · ${coverage.reportCount} published event reports</p><p>Built ${escape(coverage.builtAt)}. ${escape(coverage.selection)}</p><p>Expand a venue to inspect source states and gaps for its selected event. Times retain the source adapter’s meaning: they may identify publication, observation or retrieval. Inspect the event report and publisher before comparing clocks. Coverage is not a risk score, and a missing feed is not an all-clear.</p><p><small>Generated with the hourly report build. Reload this page to retrieve a newer publication. Future-game planning rows may intentionally omit current-condition checks.</small></p>${venues}</body></html>`;
}
