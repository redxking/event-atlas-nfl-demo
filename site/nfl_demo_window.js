const node=document.getElementById('demo-window');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));
let renderedBuild=null;
async function refresh(){
try{
  const response=await fetch('nfl_demo_window.json',{cache:'no-store'});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const data=await response.json();
  if(data.schema!=='event-atlas.nfl-demo-window.v1'||data.source?.status!=='ok'||!Array.isArray(data.games)||data.games.length!==data.counts?.total||data.games.some(game=>!/^nfl:\d+$/.test(game.id)||!Number.isFinite(Date.parse(game.kickoff))))throw Error('Invalid window snapshot');
  if(data.builtAt===renderedBuild)return;
  const rows=data.games.map(game=>`<tr><td>${esc(date(game.kickoff))}</td><td><strong>${esc(game.title)}</strong><small>Week ${esc(game.week)} · ${esc(game.scheduleStatus?.category||'status unknown')} · ${game.windowMembership==='frozen_game_moved_outside_window'?'Moved outside demo dates':''} · ${esc(game.venue.name)}, ${esc(game.venue.city||game.venue.country)}</small></td><td>${game.geographicScope==='international_schedule_only'?'<span class="window-outside">International · schedule only</span>':'<span class="window-us">U.S. venue context</span>'}</td><td><a href="window-demo.html?game=${encodeURIComponent(game.id)}">Synthetic feed replay</a> · ${game.reportUrl?`<a href="${esc(game.reportUrl)}">Game report ↗</a>`:`<a href="${esc(game.nflWeekUrl)}" target="_blank" rel="noopener noreferrer">NFL week ↗</a>`}</td></tr>`).join('');
  const reconcile=data.reconciliation.state==='matches_frozen_scope'?'Current IDs and kickoffs match the frozen demonstration scope.':`Schedule review required: ${data.reconciliation.entered.length} entered, ${data.reconciliation.left.length} left, ${data.reconciliation.kickoffChanged.length} kickoff changes, ${data.reconciliation.crosswalkMismatch.length} U.S. crosswalk differences, ${data.reconciliation.exceptions?.length||0} publisher-status exceptions, ${data.reconciliation.missing?.length||0} missing frozen games.`;
  node.innerHTML=`<div class="section-head"><div><p class="eyebrow">OCTOBER 10–23 / COMPLETE NFL DEMO WINDOW</p><h2>${esc(data.counts.total)} games in the demonstration register · ${esc(data.counts.us)} U.S. · ${esc(data.counts.international)} international</h2></div></div><p>Kickoffs are shown in Eastern time. International games are included as schedule records; U.S. venue feeds and geofences do not cover them. U.S. reports vary by source availability and remain unreviewed. ${esc(reconcile)} Checked ${esc(date(data.builtAt))}. <a href="${esc(data.source.nflWeekUrls[0])}" target="_blank" rel="noopener noreferrer">NFL Week 5 ↗</a> · <a href="${esc(data.source.nflWeekUrls[1])}" target="_blank" rel="noopener noreferrer">Week 6 ↗</a> · <a href="${esc(data.source.nflWeekUrls[2])}" target="_blank" rel="noopener noreferrer">Week 7 ↗</a></p><details><summary>Inspect all ${esc(data.counts.total)} games and coverage states</summary><div class="window-scroll"><table><thead><tr><th>Kickoff ET</th><th>Game and venue</th><th>Geographic coverage</th><th>Source report</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  renderedBuild=data.builtAt;
}catch(error){node.innerHTML='<p class="eyebrow">TWO-WEEK NFL DEMO WINDOW</p><p>Schedule coverage register is unavailable or could not be refreshed. The game list below may omit international games; confirm the dates and matchups with the NFL schedule.</p>';renderedBuild=null}
}
await refresh();
setInterval(()=>{if(document.visibilityState==='visible')refresh()},300000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});
