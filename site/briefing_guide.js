import {showWorkspaceView} from './workspace_views.js?v=multi-events-1';

// The guide uses the existing workspace and controls; it creates no separate pages.
export const briefingTourSteps=[
 {title:'Start with the national picture',target:'#venue-map',scene:'overview',text:'The map groups events by area. Marker numbers count events, not threats. Gray means no current concern flag or screening pending; it does not mean an area is safe. Select a marker to drill into that area.'},
 {title:'Set the events you are briefing',target:'.geo-controls',scene:'overview',text:'Use From, Through and Event type to define your briefing. The map, counts and report follow this scope. The NFL demonstration covers the next two weeks of U.S. games.'},
 {title:'Move from region to venue',target:'.geo-selection',scene:'overview',text:'Choose a FEMA region, then a state and venue. Each selection replaces the overview with that area’s events and concerns. At a venue, select a game and use Open game briefing. The breadcrumbs let you return to any previous level.'},
 {title:'Read the report for this area',target:'#map-panel .read-threat-report',scene:'overview',text:'Read threat report rolls up the selected area’s material findings, affected games, evidence, information gaps and decision options. Shared publisher records are counted once. Review source coverage before interpreting an absence of findings.'},
 {title:'Find and select a game',target:'#games',scene:'events',text:'Search or filter this list to find a game. Each card shows kickoff, stadium and whether a source concern needs review. Select a card to open that game’s briefing. The next steps use your selected NFL game, or the first NFL game in the current list. If no NFL game matches, the guide resets date, event-type, search and week filters to recover an available NFL game.'},
 {title:'Use the breadcrumbs',target:'.workspace-nav',scene:'event',text:'This trail shows the event’s region, state and venue. Select a previous level to return to its rollup. Back to events returns to the list. You can explore an event without losing the route back to the national picture.'},
 {title:'Understand the event map',target:'#event-geographic-map',scene:'event',tab:'map',text:'This street map shows the stadium, available source-located concerns and published airspace context. Open Map layers to show or hide overlays. Use Stadium view or Show full airspace to change the extent. Aircraft and vessel positions appear when their feeds are connected; a missing identity prompts verification, not a conclusion of hostile intent.'},
 {title:'Read the map key',target:'#event-map-key',scene:'event',tab:'map',text:'Match each marker’s shape, color and line style to this key. Stadium outlines are community-mapped geometry, not approved security perimeters. Older FAA snapshots have a different line style. Fictional tracking examples are labeled separately from received observations.'},
 {title:'Review concerns and notifications',target:'#game-attention',scene:'event',tab:'map',text:'This panel summarizes the current source concerns for the game. When source notifications appear, open their publisher records and check what changed. Mark reviewed acknowledges receipt; it does not resolve a concern. No flagged concern is different from complete source coverage.'},
 {title:'Review people and protective concerns',target:'#event-view-people',scene:'event',tab:'people',text:'People brings together protective roles and person-specific concerns for this game. The demo uses fictional VIPs and low, medium, high and resolved examples. Open a concern to review evidence, identity uncertainty, responsible role, response options and escalation or closure conditions.'},
 {title:'Inspect the supporting feeds',target:'#event-view-feeds',scene:'event',tab:'feeds',text:'Source feeds contains the supporting data rather than crowding the event map. Expand a source to inspect its records, publisher, supplied times and relationship to the game. Failed, stale, directory-only and unavailable sources are coverage limits; they are not threats.'},
 {title:'Check cameras around the stadium',target:'#cameras',scene:'event',tab:'feeds',expand:true,text:'Review the camera location and provider before using imagery. Open a supported stream or image to inspect current conditions. A directory link opens the provider’s own site. Advancing playback proves received media, not stadium coverage or a camera-derived threat assessment.'},
 {title:'Plan before, during and after the game',target:'.event-monitoring-plan',scene:'event',tab:'feeds',expand:true,text:'This plan organizes event-specific search terms, official sources and verification tasks by event phase. It describes what to check and how to validate a claim. Manual search links and candidate providers are not automatic collection feeds.'},
 {title:'Watch an assessment develop',target:'.demo-operational-feeds',scene:'event',tab:'feeds',expand:true,text:'Restart story clears the fictional incoming records. Play incoming feeds adds them one at a time, updating the briefing and any open event report. Explore all feed types shows 19 formatted examples and four correlation assessments. These examples never enter real source counts.'},
 {title:'Brief the decision',target:'#detail .read-threat-report',scene:'event',text:'Open this report to brief findings, affected operations, source confidence, gaps and conditional decisions. The incoming-feed demonstration section reflects only records received so far. Explain who owns the next check and what evidence would justify escalation or closure. The user decides what action to take.'}
];

const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
const visible=element=>Boolean(element?.isConnected&&element.getClientRects().length&&!element.closest('[hidden]'));

export function installBriefingGuide(){
 const trigger=document.getElementById('briefing-guide-open');if(!trigger)return;
 let index=0,panel,spotlight,observer,target,frame,preparing=false,stepReady=true,recoveryAttempted=false;
 const view=name=>{if(document.body.dataset.workspaceView!==name)showWorkspaceView(name);};
 const ensureEvent=()=>{
  if(document.querySelector('.game.selected[data-id^="nfl:"]')&&document.querySelector('#detail .event-view-tabs')){view('event');return true;}
  view('events');let game=document.querySelector('.game[data-id^="nfl:"]');
  if(!game&&!recoveryAttempted){recoveryAttempted=true;view('overview');const type=document.querySelector('[aria-label="Event type"]');if(type){type.value='nfl';type.dispatchEvent(new Event('change'));}view('events');for(const [id,event] of [['search','input'],['week','change']]){const control=document.getElementById(id);if(control&&control.value){control.value='';control.dispatchEvent(new Event(event,{bubbles:true}));}}game=document.querySelector('.game[data-id^="nfl:"]');}
  if(!game)return false;game.click();return Boolean(document.querySelector('#detail .event-view-tabs'));
 };
 const prepare=()=>{
  const step=briefingTourSteps[index];preparing=true;
  try{if(step.scene==='event'){if(!ensureEvent())return false;}else view(step.scene);
   if(step.tab)document.getElementById('event-tab-'+step.tab)?.click();
   const element=document.querySelector(step.target);if(step.expand&&element){const detail=element.matches('details')?element:element.closest('details');if(detail)detail.open=true;}
   return true;
  }finally{preparing=false;}
 };
 const position=()=>{
  if(!panel)return;const step=briefingTourSteps[index];target=document.querySelector(step.target);
  if(!stepReady||!visible(target)){spotlight.hidden=true;panel.querySelector('.tour-availability').textContent='This section is not available yet. Wait for the event data, or return to the previous step.';return;}
  spotlight.hidden=false;panel.querySelector('.tour-availability').textContent='';
  const r=target.getBoundingClientRect(),width=document.documentElement.clientWidth,height=window.innerHeight;
  const left=Math.max(4,r.left-5),top=Math.max(4,r.top-5),right=Math.min(width-4,r.right+5),bottom=Math.min(height-4,r.bottom+5);
  spotlight.style.cssText=`left:${left}px;top:${top}px;width:${Math.max(0,right-left)}px;height:${Math.max(0,bottom-top)}px`;
  panel.style.maxHeight='';let box=panel.getBoundingClientRect();const gap=16;let x=width-box.width-gap,y=height-box.height-gap;
  if(width-r.right>=box.width+gap*2){x=r.right+gap;y=Math.max(gap,Math.min(r.top,height-box.height-gap));}
  else if(r.left>=box.width+gap*2){x=gap;y=Math.max(gap,Math.min(r.top,height-box.height-gap));}
  else if(height-r.bottom>=box.height+gap*2){x=Math.max(gap,Math.min(r.left,width-box.width-gap));y=r.bottom+gap;}
  else if(r.top>=box.height+gap*2){x=Math.max(gap,Math.min(r.left,width-box.width-gap));y=r.top-box.height-gap;}
  else if(r.height<height/2&&Math.max(r.top,height-r.bottom)>=140){
   const below=height-r.bottom>=r.top,space=(below?height-r.bottom:r.top)-gap*2;
   panel.style.maxHeight=space+'px';box=panel.getBoundingClientRect();x=Math.max(gap,Math.min(r.left,width-box.width-gap));y=below?r.bottom+gap:r.top-box.height-gap;
  }
  panel.style.left=Math.max(8,x)+'px';panel.style.top=Math.max(8,y)+'px';
 };
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(position);};
 const close=()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);document.removeEventListener('keydown',keys);panel?.remove();spotlight?.remove();panel=spotlight=target=null;trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});};
 const render=()=>{
  stepReady=prepare();const step=briefingTourSteps[index];panel.replaceChildren();
  const progress=node('p',`Step ${index+1} of ${briefingTourSteps.length}`);progress.className='tour-progress';progress.setAttribute('aria-live','polite');
  const heading=node('h2',step.title);heading.id='briefing-tour-title';
  const availability=node('p');availability.className='tour-availability';availability.setAttribute('role','status');
  const controls=node('div');controls.className='tour-actions';const previous=node('button','Previous');previous.type='button';previous.disabled=index===0;previous.onclick=()=>{index--;render();};
  const next=node('button',index===briefingTourSteps.length-1?'Finish walkthrough':'Next');next.type='button';next.className='tour-next';next.onclick=()=>{if(index===briefingTourSteps.length-1)close();else{index++;render();}};
  const exit=node('button','Close guide');exit.type='button';exit.onclick=close;
  controls.append(previous,next,exit);const content=node('div');content.className='tour-content';content.append(progress,heading,node('p',step.text),availability);panel.append(content,controls);
  target=document.querySelector(step.target);if(visible(target))target.scrollIntoView({block:'start',behavior:'instant'});
  position();next.focus({preventScroll:true});
 };
 const keys=event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(panel?.contains(event.target)&&event.key==='ArrowRight'&&index<briefingTourSteps.length-1){event.preventDefault();index++;render();}else if(panel?.contains(event.target)&&event.key==='ArrowLeft'&&index){event.preventDefault();index--;render();}};
 trigger.setAttribute('aria-expanded','false');trigger.onclick=()=>{
  if(panel){close();return;}index=0;recoveryAttempted=false;stepReady=true;view('overview');[...document.querySelectorAll('.geo-controls button')].find(button=>button.textContent==='National view')?.click();
  spotlight=node('div');spotlight.className='briefing-tour-spotlight';spotlight.setAttribute('aria-hidden','true');
  panel=node('section');panel.className='briefing-tour-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','briefing-tour-title');
  document.body.append(spotlight,panel);trigger.setAttribute('aria-expanded','true');render();
  observer=new MutationObserver(()=>{if(preparing||!panel)return;if((!stepReady||!visible(document.querySelector(briefingTourSteps[index].target)))&&briefingTourSteps[index].scene==='event'&&document.querySelector('.game[data-id^="nfl:"]'))stepReady=prepare();schedule();});observer.observe(document.getElementById('main-content'),{childList:true,subtree:true});
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);document.addEventListener('keydown',keys);
 };
}
