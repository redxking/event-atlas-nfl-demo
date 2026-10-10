import {showWorkspaceView} from './workspace_views.js?v=multi-events-1';

const steps=[
 {title:'Set the briefing scope',story:'Begin with the national overview. Set the date range and choose NFL games. Brief the events with material concerns first, then identify the events whose source checks are still pending.',question:'Which events require attention within our area and time window?',action:'Open overview',view:'overview'},
 {title:'Explain the regional picture',story:'Select a FEMA region, then a state and venue. Open Read threat report at the level you are briefing. Explain shared findings once and name each affected event; repeated articles are not independent confirmation.',question:'Where are the concerns concentrated, and who needs to coordinate?',action:'Open overview',view:'overview'},
 {title:'Open the event',story:'Select a game from a venue or the event list. Confirm the venue and kickoff. Use the street map to explain the affected area and published airspace context. Aircraft information gaps require verification; missing identity alone does not establish hostile activity.',question:'What could affect this game, where, and when?',action:'Find an event',view:'events'},
 {title:'Test the evidence',story:'Open the relevant source details and camera sources. Check publisher, observation time, location, event overlap and freshness. A camera directory is a link to a provider; a forecast is a prediction; a delayed police record is historical context. State what each source actually supports.',question:'Is the finding current and relevant enough to support a decision?',action:'Read current report',report:true},
 {title:'Brief the decision',story:'Use the event report to state the finding, potential consequence, confidence and information gaps. Explain the available response, the responsible role, the next verification step and what would justify escalation or closure. The user decides what action to take.',question:'What decision is needed, and what evidence would change it?',action:'Read current report',report:true},
 {title:'Show the demonstration story',story:'In an NFL event, open the fictional people and concern examples. Start with a low-priority ambiguous report, compare the medium concern, then brief the high-priority targeted concern. Explain how corroboration, location and timing change the response. These examples are excluded from real source counts.',question:'How does the workflow change as evidence and urgency increase?',action:'Find an NFL event',view:'events'}
];
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function installBriefingGuide(){
 const trigger=document.getElementById('briefing-guide-open');if(!trigger)return;
 let dialog,index=0;
 const render=()=>{
  const step=steps[index];dialog.replaceChildren();
  const close=node('button','Close guide');close.type='button';close.onclick=()=>dialog.close();
  const title=node('h2','Brief an event');title.id='briefing-guide-title';
  const progress=node('p',`Step ${index+1} of ${steps.length}`);progress.className='eyebrow';
  const heading=node('h3',step.title);heading.tabIndex=-1;
  dialog.append(close,title,progress,heading,node('p',step.story),node('p','Briefing question: '+step.question));
  const actions=node('div');actions.className='guide-actions';
  const use=node('button',step.action);use.type='button';
  const reportTarget=[...document.querySelectorAll('.read-threat-report')].find(button=>button.getClientRects().length);
  use.disabled=Boolean(step.report&&!reportTarget);
  use.onclick=()=>{dialog.close();if(step.report)reportTarget?.click();else showWorkspaceView(step.view);};actions.append(use);
  if(index){const prev=node('button','Previous step');prev.type='button';prev.onclick=()=>{index--;render();};actions.append(prev);}
  if(index<steps.length-1){const next=node('button','Next step');next.type='button';next.onclick=()=>{index++;render();};actions.append(next);}
  dialog.append(actions,node('p','Reopen this guide to continue at the same step. Confirm source dates and distinguish public-source findings from fictional demonstration examples.'));
  heading.focus();
 };
 trigger.onclick=()=>{if(!dialog){dialog=node('dialog');dialog.className='briefing-guide-dialog';dialog.setAttribute('aria-labelledby','briefing-guide-title');document.body.append(dialog);}render();dialog.showModal();};
}
