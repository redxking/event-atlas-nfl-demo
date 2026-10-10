const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const inline=value=>{
  const source=String(value),linkPattern=/\[([^\]\r\n]{1,120})\]\((https:\/\/[^)\s]{1,1200})\)/g;
  let html='',start=0,match;
  while((match=linkPattern.exec(source))){
    if(match.index>0&&source[match.index-1]==='\\')continue;
    html+=esc(source.slice(start,match.index));
    try{
      const parsed=new URL(match[2]);
      html+=parsed.protocol==='https:'?`<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(match[1])} ↗</a>`:esc(match[0]);
    }catch{html+=esc(match[0])}
    start=linkPattern.lastIndex;
  }
  return (html+esc(source.slice(start))).replace(/\*\*([^*\r\n]{1,180})\*\*/g,'<strong>$1</strong>');
};

export function renderPublicReportHtml(markdown,{title,generatedAt,markdownPath,liveContext={}}){
  if(typeof markdown!=='string'||markdown.length>500000||!/^nfl-\d+\.md$/.test(markdownPath))throw Error('Invalid published report');
  const body=markdown.split('\n').map(line=>{
    if(line.startsWith('## '))return `<h2>${inline(line.slice(3))}</h2>`;
    if(line.startsWith('# '))return `<h1>${inline(line.slice(2))}</h1>`;
    if(line.startsWith('- '))return `<p class="item">${inline(line.slice(2))}</p>`;
    return line?`<p>${inline(line)}</p>`:'';
  }).join('\n');
  const latitude=Number(liveContext?.lat),longitude=Number(liveContext?.lon);
  const mode=liveContext?.monitoringMode==='near_term_monitoring'?'near_term_monitoring':'season_planning';
  const kickoff=Number.isFinite(Date.parse(liveContext?.kickoff))?new Date(liveContext.kickoff).toISOString():'';
  const venueId=/^\d{1,8}$/.test(String(liveContext?.venueId||''))?String(liveContext.venueId):'';
  const gameId=/^nfl:\d{6,12}$/.test(String(liveContext?.gameId||''))?String(liveContext.gameId):'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="Angelis Pseftis"><meta name="generator" content="Event Atlas automated public-source compilation"><title>${esc(title)}</title><style>body{margin:0;background:#07131c;color:#e8f1f3;font:16px/1.58 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:28px 22px 70px}header{border-bottom:1px solid #36505d;padding-bottom:20px;margin-bottom:28px}.eyebrow{color:#8cbdc7;text-transform:uppercase;letter-spacing:.1em;font-size:.76rem}h1{font-size:2rem;line-height:1.2}h2{font-size:1.25rem;margin-top:2.3rem;border-top:1px solid #36505d;padding-top:1rem}p{margin:.55rem 0}.item{padding-left:1.2rem;text-indent:-1.2rem}.item:before{content:'• ';color:#e5a15a}a{color:#8bd9ee;overflow-wrap:anywhere}strong{color:#fff}.note{color:#a9bdc5}.live-panel{border:1px solid #4b6f7a;border-radius:8px;background:#0d222c;padding:14px 18px;margin:25px 0}.live-panel h2{margin:0 0 .5rem;border:0;padding:0}.live-panel p{margin:.45rem 0}time{font-variant-numeric:tabular-nums}</style><script type="module" src="../report_refresh.js?v=20261010-1"></script><script type="module" src="../report_live_nws.js?v=20261010-1"></script><script type="module" src="../report_live_nws_forecast.js?v=20261010-1"></script><script type="module" src="../report_live_game.js?v=20261010-1"></script><script type="module" src="../report_live_public_safety.js?v=20261010-1"></script></head><body><main data-report-path="reports/${esc(markdownPath.replace(/\.md$/,'.html'))}" data-generated-at="${esc(generatedAt)}" data-monitoring-mode="${mode}" data-venue-id="${venueId}" data-game-id="${gameId}" data-home="${esc(liveContext?.home||'')}" data-away="${esc(liveContext?.away||'')}" data-venue-lat="${Number.isFinite(latitude)?latitude:''}" data-venue-lon="${Number.isFinite(longitude)?longitude:''}" data-kickoff="${esc(kickoff)}" data-event-status="${esc(liveContext?.status||'')}"><header><p class="eyebrow">Event Atlas / published public-source report</p><p class="note">Generated <time>${esc(generatedAt)}</time>. Unreviewed point-in-time compilation; source feeds update on different schedules. Confirm current source records before action.</p><p class="note" id="revision-status" role="status">Checking for a newer published report every five minutes while this page is open.</p><p><a href="${esc(markdownPath)}">Download authoritative Markdown report ↗</a> · <a href="../">Return to NFL demo ↗</a></p></header><section class="live-panel" aria-label="Direct ESPN game check"><h2>Direct ESPN game check</h2><div id="direct-game" role="status"><p>Checking whether a current publisher game record applies.</p></div></section><section class="live-panel" aria-label="Direct NWS point-alert check"><h2>Direct NWS point-alert check</h2><div id="direct-nws" role="status"><p>Checking whether a current point query applies to this event.</p></div></section><section class="live-panel" aria-label="Direct NWS hourly forecast"><h2>Direct NWS hourly forecast</h2><div id="direct-nws-forecast" role="status"><p>Checking whether an hourly forecast applies to this event.</p></div></section><section class="live-panel" aria-label="Direct public-safety aggregate check"><h2>Direct public-safety aggregate check</h2><div id="direct-public-safety" role="status"><p>Checking whether a supported city aggregate applies to this event.</p></div></section>${body}</main></body></html>\n`;
}
