const views=['overview','events','event'];
export function showWorkspaceView(view,{record=true}={}){
 if(!views.includes(view))view='overview';
 document.body.dataset.workspaceView=view;
 const main=document.getElementById('main-content');
 for(const section of main.children){if(section.matches('.hero,.workspace-nav'))continue;let visible=false;
  if(section.id==='map-panel')visible=view==='overview';
  if(section.id==='schedule')visible=view==='events'||view==='event';
  section.hidden=!visible;
 }
 const games=document.querySelector('.game-column'),brief=document.getElementById('briefing');if(games)games.hidden=view!=='events';if(brief)brief.hidden=view!=='event';
 const names={overview:'NFL event overview',events:'Find an event',event:'Event briefing'};
 document.querySelector('.hero h1').textContent=names[view];
 document.querySelector('.hero .intro').textContent=view==='overview'?'Explore national, regional and local event summaries. Select an event to open its briefing.':view==='event'?'Review the selected event’s map, concerns, people and supporting sources.':'Use the navigation to return to the overview or open an event.';
 document.querySelectorAll('[data-workspace-view]').forEach(button=>button.setAttribute('aria-current',button.dataset.workspaceView===view?'page':'false'));
 if(record){history.pushState({...history.state,workspaceView:view},'',view==='overview'?'#overview':'#'+view);window.scrollTo({top:0,behavior:'instant'});}
 window.dispatchEvent(new Event('resize'));
}
export function initializeWorkspaceViews(){
 const nav=document.querySelector('.workspace-nav');nav.replaceChildren();
 const back=document.createElement('button');back.type='button';back.textContent='← Back';back.onclick=()=>{if(history.state?.workspaceView||history.state?.geo)history.back();else showWorkspaceView('overview');};nav.append(back);
 for(const [view,label]of [['overview','Overview'],['events','Events']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.workspaceView=view;b.onclick=()=>showWorkspaceView(view);nav.append(b);}
 window.addEventListener('popstate',()=>showWorkspaceView(history.state?.workspaceView||'overview',{record:false}));
 showWorkspaceView('overview',{record:false});
}
