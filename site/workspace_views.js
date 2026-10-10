let geographicTrail=[], eventTrail=[], selectedEvent=null, restoreEvent=null, eventOrigin='overview';
export function setGeographicTrail(trail){geographicTrail=trail;renderNavigation();}
export function setEventNavigation(game,trail){selectedEvent=game;eventTrail=trail;renderNavigation();}
function renderNavigation(){
 const nav=document.querySelector('.workspace-nav');if(!nav)return;
 const view=document.body.dataset.workspaceView||'overview';
 const trail=view==='event'?[...eventTrail,{label:selectedEvent?.title||'Event briefing'}]:view==='events'?[...geographicTrail,{label:'Events'}]:geographicTrail;
 nav.replaceChildren();
 if(trail.length>1){const back=document.createElement('button');back.type='button';back.textContent=view==='event'&&eventOrigin==='events'?'← Back to events':'← '+trail[trail.length-2].label;back.onclick=()=>view==='event'&&eventOrigin==='events'?showWorkspaceView('events'):trail[trail.length-2].go?.();nav.append(back);}
 const list=document.createElement('ol');list.className='workspace-breadcrumbs';
 trail.forEach((item,index)=>{const li=document.createElement('li');const current=index===trail.length-1;const control=document.createElement(current?'span':'a');control.textContent=item.label;if(current)control.setAttribute('aria-current','page');else{control.href=item.href||'#overview';control.onclick=e=>{e.preventDefault();item.go?.();};}li.append(control);list.append(li);});nav.append(list);
 if(view!=='events'){const events=document.createElement('button');events.type='button';events.textContent='Events';events.onclick=()=>showWorkspaceView('events');nav.append(events);}
}
const views=['overview','events','event'];
export function showWorkspaceView(view,{record=true}={}){
 if(!views.includes(view))view='overview';
 if(view==='event'&&record)eventOrigin=document.body.dataset.workspaceView||'overview';
 document.body.dataset.workspaceView=view;
 const main=document.getElementById('main-content');
 for(const section of main.children){if(section.matches('.hero,.workspace-nav'))continue;let visible=false;
  if(section.id==='map-panel')visible=view==='overview';
  if(section.id==='schedule')visible=view==='events'||view==='event';
  section.hidden=!visible;
 }
 const games=document.querySelector('.game-column'),brief=document.getElementById('briefing');if(games)games.hidden=view!=='events';if(brief)brief.hidden=view!=='event';
 const names={overview:'Event overview',events:'Find an event',event:'Event briefing'};
 document.querySelector('.hero h1').textContent=names[view];
 document.querySelector('.hero .intro').textContent=view==='overview'?'Explore national, regional and local event summaries. Select an event to open its briefing.':view==='event'?'Review the selected event’s map, concerns, people and supporting sources.':'Use the navigation to return to the overview or open an event.';
 document.querySelectorAll('[data-workspace-view]').forEach(button=>button.setAttribute('aria-current',button.dataset.workspaceView===view?'page':'false'));
 if(record){history.pushState({...history.state,workspaceView:view,eventId:selectedEvent?.id,eventOrigin},'',view==='overview'?'#overview':'#'+view);window.scrollTo({top:0,behavior:'instant'});}
 renderNavigation();
 window.dispatchEvent(new Event('workspaceviewchange'));
 window.dispatchEvent(new Event('resize'));
}
export function initializeWorkspaceViews({onRestoreEvent}={}){
 restoreEvent=onRestoreEvent;
 document.querySelector('.workspace-nav').setAttribute('aria-label','Breadcrumb');
 window.addEventListener('popstate',()=>{eventOrigin=history.state?.eventOrigin||'overview';if(history.state?.workspaceView==='event'&&history.state.eventId)restoreEvent?.(history.state.eventId);showWorkspaceView(history.state?.workspaceView||'overview',{record:false});});
 showWorkspaceView('overview',{record:false});
}
