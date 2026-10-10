const https=url=>{try{return new URL(url).protocol==='https:'}catch{return false}};
export function validateWindowPublicBundle(bundle,game){
 if(bundle?.schema!=='event-atlas.public-evidence-bundle.v1'||bundle.status!=='unreviewed_public_source_export'||bundle.event?.id!==game.id||String(bundle.venue?.id)!==String(game.venue.id)||Date.parse(bundle.event.kickoff)!==Date.parse(game.kickoff)||!Array.isArray(bundle.picture?.sources)||!Number.isFinite(Date.parse(bundle.generatedAt)))throw Error('Published report identity or schedule does not match this game');
 return {generatedAt:bundle.generatedAt,sources:bundle.picture.sources.slice(0,100).map(s=>({name:String(s.name||''),state:String(s.state||''),asOf:String(s.asOf||''),detail:String(s.detail||''),sourceUrl:https(s.sourceUrl)?s.sourceUrl:null}))};
}
export function createWindowPublicContext(target){
 let sequence=0;
 const line=text=>{const p=document.createElement('p');p.textContent=text;target.append(p)};
 const link=(url,text)=>{const a=document.createElement('a');a.href=url;a.textContent=text;a.target='_blank';a.rel='noopener noreferrer';target.append(a);target.append(document.createTextNode(' · '))};
 return {async update(game){const request=++sequence;target.replaceChildren();const h=document.createElement('h2');h.textContent='Public-source context · separate from exercise';target.append(h);
 if(https(game.sourceUrl))link(game.sourceUrl,'Published game schedule');
 if(!/^reports\/nfl-\d+\.html$/.test(game.reportUrl||'')){line('International game: U.S. agency connectors do not cover this venue. Use the published schedule; operational feed examples below are simulated.');return}
 link(game.reportUrl,'Full public-source report and camera views');link(game.reportUrl.replace('.html','.evidence.json'),'Public evidence JSON');line('Loading published source coverage…');
 try{const response=await fetch(game.reportUrl.replace('.html','.evidence.json'),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Published evidence unavailable');const bundle=validateWindowPublicBundle(await response.json(),game);if(request!==sequence)return;
 target.querySelector('p').remove();line(`Report built ${bundle.generatedAt}. Source states below describe the published snapshot, not a live check. Each source has its own observation time. These public records are not combined with synthetic observations or synthetic exports.`);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`Inspect ${bundle.sources.length} source states`;details.append(summary);
 for(const s of bundle.sources){const article=document.createElement('article'),title=document.createElement('strong'),p=document.createElement('p');title.textContent=`${s.name} · ${s.state}`;p.textContent=`${s.asOf||'Observation time unknown'} · ${s.detail}`;article.append(title,p);if(s.sourceUrl){const a=document.createElement('a');a.href=s.sourceUrl;a.textContent='Publisher source';a.target='_blank';a.rel='noopener noreferrer';article.append(a)}details.append(article)}target.append(details);
 }catch(error){if(request===sequence)line(`Public-source context unavailable: ${error.message}. This is not an all-clear.`)}
 }};
}
