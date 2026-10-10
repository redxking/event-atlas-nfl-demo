import {createGameFeed,replayGameFeed} from './window_feed_engine.js';
import {recordExerciseReview,applyExerciseReviews} from './window_review_engine.js';
import {createSyntheticCamera} from './window_camera.js';
import {makeMonitoringArea,withSpatialContext} from './window_spatial_engine.js';
import {appendBriefSnapshot,historyArchive} from './window_brief_history.js';
import {windowRelationships} from './window_relationships.js';
import {bindExerciseModelSnapshot} from './window_ai_contract.js';
import {createWindowMap} from './window_map.js';
import {createWindowPublicContext} from './window_public_context.js';
const publicContext=createWindowPublicContext(document.getElementById('public-context'));
const map=createWindowMap(document.getElementById('map-demo'),next=>{area=next;areaHistory.push(next);render()});
const camera=createSyntheticCamera(document.getElementById('camera-demo'));
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let briefHistory=[],modelSnapshots={},venues=[],area=null,areaHistory=[],games=[],feed,count=0,clock=null,timer=null,brief,reviews=[];
const sessions=new Map();
function stop(){clearInterval(timer);timer=null;$('play').textContent='Play feed'}
function render(){
 brief=applyExerciseReviews(withSpatialContext(replayGameFeed(feed,count,clock),venues.find(v=>v.id===feed.event.venue.id),area),reviews);
 brief.monitoringAreaHistory=areaHistory;
 brief.modelReview=bindExerciseModelSnapshot(brief,modelSnapshots[feed.event.id]);
 const ai=brief.modelReview;
 $('model-demo').innerHTML=`<h2>Recorded local model review</h2><p>${esc(({recorded_model_run_matches_inputs:'Recorded model run matches this feed state',not_available:'No recorded model run available',input_changed_or_snapshot_invalid:'No matching model run for the current feed state',invalid_model_output:'Recorded output failed validation'})[ai.status]||'Model result unavailable')}</p>${ai.rankedCandidates?`<p>${esc(ai.model)} · run ${esc(ai.generatedAt)} · ${esc(ai.elapsedMs)} ms. This is a saved inference result, not a live browser model call. Monitoring-area edits and operator decisions were not model inputs.</p><ol>${ai.rankedCandidates.map(c=>`<li><strong>${esc(c.title)}</strong><p>${esc(c.basis)}</p><p>Verification action: ${esc(c.next)}</p><p>Evidence: ${[...c.evidenceIds,...c.contraryEvidenceIds].map(id=>`<a href="#${esc(id)}">${esc(id.split(':').at(-1))}</a>`).join(', ')}</p></li>`).join('')}</ol><p>${esc(ai.limitations)}</p><details><summary>Inference provenance</summary><p>Input SHA-256: <code>${esc(ai.packetSha256)}</code></p><p>Response SHA-256: <code>${esc(ai.responseSha256)}</code></p></details>`:'<p>No applicable recorded model output for these exact inputs. The feed replay remains deterministic. Complete the feed to use a matching saved run, if available. No model fallback or new inference is being claimed.</p>'}`;
 sessions.set(feed.event.id,{count,clock,reviews,area,areaHistory});
 const related=windowRelationships(games,feed.event.id,[...sessions.entries()].map(([id,s])=>replayGameFeed(createGameFeed(games.find(g=>g.id===id)),s.count,s.clock)));
 brief.relationships=related;
 $('relationships').innerHTML=`<h2>Cross-game relationships</h2><p>${esc(related.scope)}</p><h3>Shared venue</h3>${related.venueLinks.map(r=>`<article><button data-related-game="${esc(r.eventId)}">${esc(r.title)}</button><p>${esc(r.kickoff)} · ${esc(r.basis)}</p></article>`).join('')||'<p>No other scoped game uses this venue.</p>'}<h3>Repeated exercise claims</h3>${related.evidenceLinks.map(r=>`<article><button data-related-game="${esc(r.eventId)}">${esc(r.title)}</button><p>${esc(r.basis)}</p><p>References: ${r.evidenceIds.map(esc).join(' · ')}</p></article>`).join('')||'<p>No matching injected claim in another game session. Inject records in another game to demonstrate duplicate-claim handling.</p>'}`;
 map.update(brief);
 camera.update(brief);
 briefHistory=appendBriefSnapshot(briefHistory,brief);
 brief.reportHistory=briefHistory.map(s=>({id:s.id,savedAt:s.savedAt,feedVersion:s.brief.version,areaRevision:s.brief.monitoringArea.revision}));
 sessions.get(feed.event.id).briefHistory=briefHistory;
 $('status').textContent=`Synthetic delivery ${count}/${feed.deliveries.length} · brief revision ${brief.version} · ${brief.clock} · ${brief.duplicatesExcluded} duplicate excluded`;
 $('next').disabled=$('finish').disabled=count===feed.deliveries.length;
 $('venue').textContent=`${feed.event.venue.name} · ${feed.event.venue.city||feed.event.venue.country} · kickoff ${new Date(feed.event.kickoff).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})}`;
 $('content').innerHTML=`<section><h2>Briefing · exercise review</h2><p>Review controls simulate an unauthenticated operator. Decisions persist only in this page session and are included in the export. Reset clears this game’s session.</p><p>${brief.observations.length} current evidence records across ${brief.sources.filter(s=>s.lastReceivedAt).length} sources. Severity: not assessed. Deterministic replay; no model invoked.</p>${brief.candidates.map(c=>`<article><h3>${esc(c.title)}</h3><p>${esc(c.basis)}</p><p>Review: ${esc(c.next)}</p><small>${esc(c.state)} · Review: ${esc(c.review.status)}${c.review.decision?` · ${esc(c.review.decision)}`:''}</small><div class="review-actions">${[['needs_verification','Needs verification'],['exercise_follow_up','Exercise follow-up'],['dismissed_in_exercise','Dismiss in exercise']].map(([value,label])=>`<button data-candidate="${esc(c.id)}" data-decision="${value}">${label}<span class="sr-only">: ${esc(c.title)}</span></button>`).join('')}</div><p>Evidence: ${c.evidenceIds.map(id=>`<a href="#${esc(id)}">${esc(id.split(':').at(-1))}</a>`).join(', ')}</p>${c.contraryEvidenceIds.length?`<p>Contrary evidence: ${c.contraryEvidenceIds.map(id=>`<a href="#${esc(id)}">${esc(id.split(':').at(-1))}</a>`).join(', ')}</p>`:''}</article>`).join('')||'<p>Awaiting enough injected evidence for a correlation candidate.</p>'}</section><section><h2>Feed health</h2><div class="scroll"><table><thead><tr><th>Synthetic source</th><th>State</th><th>Last receipt · exercise clock</th></tr></thead><tbody>${brief.sources.map(s=>`<tr><td>${esc(s.name)}<small>${esc(s.domain)}</small></td><td>${esc(s.state)}</td><td>${esc(s.lastReceivedAt||'No records')}</td></tr>`).join('')}</tbody></table></div></section><section><h2>Current evidence</h2>${brief.observations.map(r=>`<article id="${esc(r.evidenceId)}"><strong>${esc(r.recordId)} · revision ${r.revision}</strong><p>${esc(r.claim)}</p>${r.payload?`<details><summary>Normalized synthetic payload</summary><pre>${esc(JSON.stringify(r.payload,null,2))}</pre></details>`:''}<small>${esc(r.evidenceId)} · ${esc(r.observedAt)} · SYNTHETIC</small></article>`).join('')||'<p>No records injected.</p>'}</section><section><h2>Brief snapshot history</h2><p>Local session only; use Export brief history to preserve complete evidence, area, review and model states.</p><ol>${brief.reportHistory.map(s=>`<li>${esc(s.id)} · feed ${s.feedVersion} · area revision ${s.areaRevision}<small>${esc(s.savedAt)}</small></li>`).join('')}</ol></section><section><h2>Exercise review history</h2><ol>${reviews.map(r=>`<li>${esc(r.candidateId)} · ${esc(r.decision)} · brief ${r.briefVersion}<small>${esc(r.recordedAt)} · ${esc(r.actor)} · ${r.evidenceIds.length} supporting / ${r.contraryEvidenceIds.length} contrary evidence records</small></li>`).join('')}</ol></section><section><h2>Delivery and correction history</h2><ol>${brief.history.map(r=>`<li>${esc(r.observedAt)} · ${esc(r.operation)} · ${esc(r.recordId||r.sourceId)}<small>${esc(r.claim)}</small></li>`).join('')}</ol></section>`;
}
function select(){stop();const selectedGame=games.find(g=>g.id===$('game').value);publicContext.update(selectedGame);feed=createGameFeed(selectedGame);const saved=sessions.get(feed.event.id);count=saved?.count||0;clock=saved?.clock||null;reviews=saved?.reviews||[];area=saved?.area||makeMonitoringArea(venues.find(v=>v.id===feed.event.venue.id));areaHistory=saved?.areaHistory||[area];briefHistory=saved?.briefHistory||[];render()}
function next(){clock=null;if(count<feed.deliveries.length){count++;render()}if(count===feed.deliveries.length)stop()}
try{
 const response=await fetch('nfl_demo_window.json',{cache:'no-store'});if(!response.ok)throw Error('Schedule unavailable');const data=await response.json();
 if(data.schema!=='event-atlas.nfl-demo-window.v1'||!Array.isArray(data.games)||data.games.length!==data.counts.total)throw Error('Invalid scope');
 const venueResponse=await fetch('window_venues.json');if(!venueResponse.ok)throw Error('Venue coordinates unavailable');venues=(await venueResponse.json()).venues;
 if(!Array.isArray(venues)||data.games.some(g=>!venues.some(v=>v.id===g.venue.id)))throw Error('Scoped venue coordinate missing');
 try{const modelResponse=await fetch('window_model_snapshots.json');if(modelResponse.ok)modelSnapshots=(await modelResponse.json()).results||{}}catch{}
 games=data.games;$('game').innerHTML=games.map(g=>`<option value="${esc(g.id)}">${esc(g.title)} · ${esc(g.kickoff.slice(0,10))}</option>`).join('');
 const requested=new URLSearchParams(location.search).get('game');if(games.some(g=>g.id===requested))$('game').value=requested;
 $('relationships').onclick=event=>{const button=event.target.closest('button[data-related-game]');if(button){$('game').value=button.dataset.relatedGame;select()}};
 $('game').onchange=select;$('reset').onclick=()=>{sessions.delete(feed.event.id);select()};$('next').onclick=next;
 $('content').onclick=event=>{const button=event.target.closest('button[data-candidate]');if(!button)return;stop();const id=button.dataset.candidate,decision=button.dataset.decision;reviews=recordExerciseReview(brief,id,decision,reviews);render();document.querySelector(`button[data-candidate="${id}"][data-decision="${decision}"]`)?.focus()};
 $('play').onclick=()=>{if(timer){stop();return}if(count===feed.deliveries.length){count=0;clock=null;reviews=[];render()}timer=setInterval(next,1200);$('play').textContent='Pause feed'};
 $('finish').onclick=()=>{stop();clock=null;count=feed.deliveries.length;render()};
 $('stale').onclick=()=>{stop();clock=new Date(Date.parse(brief.clock)+31*60000).toISOString();render()};
 $('export-history').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(historyArchive(briefHistory),null,2)],{type:'application/json'}));a.href=url;a.download=`${feed.event.id.replace(':','-')}-SYNTHETIC-history.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(brief,null,2)],{type:'application/json'}));a.href=url;a.download=`${feed.event.id.replace(':','-')}-SYNTHETIC-revision-${brief.version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 select();
}catch(error){stop();$('status').textContent=`Replay unavailable: ${error.message}`;document.querySelectorAll('button').forEach(b=>b.disabled=true)}
