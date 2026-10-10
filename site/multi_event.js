import {monitorPublicEvent} from './public_event_monitor.js?v=event-monitoring-2';
import {installEventWorkspaceTabs} from './event_workspace_tabs.js?v=event-views-1';
import {renderEventMonitoringPlan} from './event_monitoring_plan.js?v=event-monitoring-2';
import {createThreatReportButton} from './scope_threat_report.js?v=grouped-decisions-1';
import {renderEventGeographicMap} from './event_geographic_map.js?v=map-key-2';
export {eventTypeLabel,exampleSummary} from './event_catalog.js?v=event-monitoring-1';
import {eventTypeLabel} from './event_catalog.js?v=event-monitoring-1';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function renderAdditionalEvent(target,game,summaries,onUpdate){
 target.replaceChildren();target.append(node('span',eventTypeLabel(game)),node('h3',game.title));target.append(createThreatReportButton(()=>({title:game.title,level:'event',games:[game],summaries})));
 const date=value=>new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})+' ET';
 target.append(node('p',game.venue.name+' · '+game.venue.address),node('p',date(game.kickoff)+' through '+date(game.endsAt)));
 const info=node('details');info.className='source-drilldown';info.append(node('summary','Published event details'),node('p',game.description||''));
 const source=node('a','Published event or location record');source.href=game.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';info.append(source,node('p','Source snapshot: '+date(game.sourceRetrievedAt)+'. Confirm current details with the publisher.'));
 if(game.eventType==='voting'){info.append(node('h4','Voting-site details'),node('p','Dates: '+game.datesOpen+' · Daily hours: '+game.hours),node('p','Voting space: '+game.votingSpace+' · Accessibility: '+game.accessibility),node('p','The map identifies a published site, not a voter assignment. No voter records or political affiliations are collected.'));}target.append(info);
 const mapSection=node('section');mapSection.className='detail-section event-map-panel';mapSection.append(node('h4','Event location & surroundings'));const actions=node('div');actions.className='event-map-actions';for(const [id,label]of [['map-show-stadium','Venue view'],['map-show-airspace','Surrounding area']]){const b=node('button',label);b.id=id;actions.append(b);}mapSection.append(actions);for(const [tag,id]of [['div','event-geographic-map'],['p','event-map-status'],['p','event-map-tile-status']]){const e=node(tag);e.id=id;mapSection.append(e);}target.append(mapSection);renderEventGeographicMap(game,null,null);
 const weather=node('section');weather.className='detail-section';weather.id='game-attention';weather.append(node('h4','Current event weather alerts'));const weatherBody=node('div');weather.append(weatherBody);target.append(weather);monitorPublicEvent(game,weatherBody,summaries,onUpdate);renderEventMonitoringPlan(target,game);
 const examples=node('section');examples.className='detail-section';examples.id='people-protection';examples.append(node('h4','Demo incident examples'),node('p','Fictional observations illustrate the response workflow. They are not reports about this real event or location.'));
 for(const c of game.scenarios||[]){const article=node('article');article.className='report-finding';article.append(node('h4',c.priority.toUpperCase()+' — '+c.title),node('p',c.observation),node('p','Uncertainty: '+c.uncertainty),node('p','Decision: '+c.decision),node('p','Responsible role: '+c.owner),node('p','Escalate when: '+c.escalate+' Close when: '+c.close));examples.append(article);}target.append(examples);installEventWorkspaceTabs(target,{peopleLabel:'Scenarios'});
}
