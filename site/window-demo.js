import {createGameFeed,replayGameFeed} from './window_feed_engine.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let games=[],feed,count=0,clock=null,timer=null,brief;
function stop(){clearInterval(timer);timer=null;$('play').textContent='Play feed'}
function render(){
 brief=replayGameFeed(feed,count,clock);
 $('status').textContent=`Synthetic delivery ${count}/${feed.deliveries.length} · brief revision ${brief.version} · ${brief.clock} · ${brief.duplicatesExcluded} duplicate excluded`;
 $('next').disabled=$('finish').disabled=count===feed.deliveries.length;
 $('venue').textContent=`${feed.event.venue.name} · ${feed.event.venue.city||feed.event.venue.country} · kickoff ${new Date(feed.event.kickoff).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})}`;
 $('content').innerHTML=`<section><h2>Briefing · unreviewed exercise</h2><p>${brief.observations.length} current evidence records across ${brief.sources.filter(s=>s.lastReceivedAt).length} sources. Severity: not assessed. Deterministic replay; no model invoked.</p>${brief.candidates.map(c=>`<article><h3>${esc(c.title)}</h3><p>${esc(c.basis)}</p><p>Review: ${esc(c.next)}</p><small>${esc(c.state)}</small><p>Evidence: ${c.evidenceIds.map(id=>`<a href="#${esc(id)}">${esc(id.split(':').at(-1))}</a>`).join(', ')}</p>${c.contraryEvidenceIds.length?`<p>Contrary evidence: ${c.contraryEvidenceIds.map(id=>`<a href="#${esc(id)}">${esc(id.split(':').at(-1))}</a>`).join(', ')}</p>`:''}</article>`).join('')||'<p>Awaiting enough injected evidence for a correlation candidate.</p>'}</section><section><h2>Feed health</h2><div class="scroll"><table><thead><tr><th>Synthetic source</th><th>State</th><th>Last receipt · exercise clock</th></tr></thead><tbody>${brief.sources.map(s=>`<tr><td>${esc(s.name)}<small>${esc(s.domain)}</small></td><td>${esc(s.state)}</td><td>${esc(s.lastReceivedAt||'No records')}</td></tr>`).join('')}</tbody></table></div></section><section><h2>Current evidence</h2>${brief.observations.map(r=>`<article id="${esc(r.evidenceId)}"><strong>${esc(r.recordId)} · revision ${r.revision}</strong><p>${esc(r.claim)}</p><small>${esc(r.evidenceId)} · ${esc(r.observedAt)} · SYNTHETIC</small></article>`).join('')||'<p>No records injected.</p>'}</section><section><h2>Delivery and correction history</h2><ol>${brief.history.map(r=>`<li>${esc(r.observedAt)} · ${esc(r.operation)} · ${esc(r.recordId||r.sourceId)}<small>${esc(r.claim)}</small></li>`).join('')}</ol></section>`;
}
function select(){stop();count=0;clock=null;feed=createGameFeed(games.find(g=>g.id===$('game').value));render()}
function next(){clock=null;if(count<feed.deliveries.length){count++;render()}if(count===feed.deliveries.length)stop()}
try{
 const response=await fetch('nfl_demo_window.json',{cache:'no-store'});if(!response.ok)throw Error('Schedule unavailable');const data=await response.json();
 if(data.schema!=='event-atlas.nfl-demo-window.v1'||!Array.isArray(data.games)||data.games.length!==data.counts.total)throw Error('Invalid scope');
 games=data.games;$('game').innerHTML=games.map(g=>`<option value="${esc(g.id)}">${esc(g.title)} · ${esc(g.kickoff.slice(0,10))}</option>`).join('');
 const requested=new URLSearchParams(location.search).get('game');if(games.some(g=>g.id===requested))$('game').value=requested;
 $('game').onchange=select;$('reset').onclick=select;$('next').onclick=next;
 $('play').onclick=()=>{if(timer){stop();return}if(count===feed.deliveries.length){count=0;clock=null;render()}timer=setInterval(next,1200);$('play').textContent='Pause feed'};
 $('finish').onclick=()=>{stop();clock=null;count=feed.deliveries.length;render()};
 $('stale').onclick=()=>{stop();clock=new Date(Date.parse(brief.clock)+31*60000).toISOString();render()};
 $('export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(brief,null,2)],{type:'application/json'}));a.href=url;a.download=`${feed.event.id.replace(':','-')}-SYNTHETIC-revision-${brief.version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 select();
}catch(error){stop();$('status').textContent=`Replay unavailable: ${error.message}`;document.querySelectorAll('button').forEach(b=>b.disabled=true)}
