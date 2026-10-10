import {concernIdentity} from './concern_location.js';
import {humanText} from './attention_summary.js';
const safe=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
const signature=cue=>JSON.stringify([cue.trigger,cue.basis,cue.sourceAt,cue.action,cue.domain,cue.location]);
export function createEventNotifications(){
 const events=new Map();let serial=0;
 return {
  update(eventId,items,now=Date.now()){
   if(!events.has(eventId))events.set(eventId,{seen:false,records:new Map()});
   const state=events.get(eventId),present=new Set();
   for(const cue of items||[]){if(cue.status!=='unreviewed_source_cue'||!safe(cue.sourceUrl))continue;
    const key=concernIdentity(cue);present.add(key);const previous=state.records.get(key),stamp=signature(cue);
    if(!previous||previous.signature!==stamp||!previous.present){state.records.set(key,{key,cue:{...cue},signature:stamp,observedAt:now,order:++serial,acknowledged:false,present:true,label:!previous?(state.seen?'New source concern':'Source concern available'):!previous.present?'Source concern returned':'Source concern updated'});}
    else previous.present=true;
   }
   for(const [key,record]of state.records)if(!present.has(key))record.present=false;
   state.seen=true;
   const sorted=[...state.records.values()].sort((a,b)=>b.order-a.order);
   for(const record of sorted.slice(50))state.records.delete(record.key);
   return this.list(eventId);
  },
  list(eventId){return [...(events.get(eventId)?.records.values()||[])].sort((a,b)=>Number(a.acknowledged)-Number(b.acknowledged)||b.order-a.order);},
  acknowledge(eventId,key){const record=events.get(eventId)?.records.get(key);if(record)record.acknowledged=true;}
 };
}
const store=createEventNotifications();
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function renderEventNotifications(target,game,items){
 if(!target)return;
 store.update(game.id,items);target.replaceChildren();
 const records=store.list(game.id),pending=records.filter(r=>!r.acknowledged&&r.present).length;
 const title=node('h4','Event notifications'+(pending?' · '+pending+' to review':''));title.setAttribute('aria-live','polite');target.append(title);
 if(!records.length){target.hidden=true;return;}target.hidden=false;
 target.append(node('p','Source changes observed while this workspace is open. Review confirms receipt only; it does not resolve a concern or establish a threat.'));
 const list=node('details');list.open=pending>0;list.append(node('summary','Review source notifications ('+records.length+')'));
 for(const record of records){const card=node('article');card.className='brief-cue';card.append(node('strong',record.label+' · '+humanText(record.cue.trigger)),node('p',humanText(record.cue.basis)),node('p','Next step: '+humanText(record.cue.action)));
 card.append(node('small',(record.acknowledged?'Reviewed':'Awaiting review')+' · '+(record.present?'In the latest source sample':'Not in the latest sample — resolution unverified')+' · Observed '+new Date(record.observedAt).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'})));
 const link=node('a','Review publisher record');link.href=record.cue.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';card.append(node('p'),link);
 if(!record.acknowledged){const button=node('button','Mark reviewed');button.type='button';button.onclick=()=>{store.acknowledge(game.id,record.key);renderEventNotifications(target,game,items);};card.append(button);}
 list.append(card);
 }target.append(list);
}
