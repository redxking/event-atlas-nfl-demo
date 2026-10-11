export function installEventWorkspaceTabs(target,{peopleLabel='People'}={}){
 if(!target||target.querySelector('.event-view-tabs'))return;
 const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
 const choices=[['map','Map & alerts'],['people',peopleLabel],['feeds','Source feeds']];
 const nav=node('nav');nav.className='event-view-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Event views');
 const panels=new Map(),buttons=new Map();
 for(const [id,label] of choices){const panel=node('section');panel.id='event-view-'+id;panel.className='event-view-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','event-tab-'+id);panel.tabIndex=0;panels.set(id,panel);const button=node('button',label);button.type='button';button.id='event-tab-'+id;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);buttons.set(id,button);nav.append(button);}
 const map=target.querySelector('.event-map-panel'),alerts=target.querySelector('#game-attention'),people=target.querySelector('#people-protection');
 if(map)panels.get('map').append(map);
 const rail=node('aside');rail.className='event-concern-rail';rail.setAttribute('aria-label','Event assessment and notifications');
 if(alerts)rail.append(alerts);const notices=target.querySelector('#event-notifications');if(notices)rail.append(notices);
 if(rail.childElementCount)panels.get('map').append(rail);
 if(people)panels.get('people').append(people);
 const feeds=panels.get('feeds');feeds.append(node('h4','Source feeds'),node('p','Open a source to review its records, timestamps and event relevance. Failed or delayed sources remain visible as coverage gaps.'));
 for(const section of [...target.querySelectorAll(':scope > .source-drilldown,:scope > .event-monitoring-plan,:scope > .facts')])feeds.append(section);
 target.append(nav,...panels.values());
 const select=(id,focus=false)=>{for(const [key,panel]of panels){panel.hidden=key!==id;const button=buttons.get(key);button.setAttribute('aria-selected',String(key===id));button.tabIndex=key===id?0:-1;}target.dataset.eventView=id;if(focus)buttons.get(id).focus();window.dispatchEvent(new Event('resize'));};
 for(const [id,button]of buttons){button.onclick=()=>select(id);button.onkeydown=event=>{const order=choices.map(([key])=>key),i=order.indexOf(id);let next;if(event.key==='ArrowRight')next=order[(i+1)%order.length];if(event.key==='ArrowLeft')next=order[(i+order.length-1)%order.length];if(event.key==='Home')next=order[0];if(event.key==='End')next=order.at(-1);if(next){event.preventDefault();select(next,true);}};}
 select('map');
}
