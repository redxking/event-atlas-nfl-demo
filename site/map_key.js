export const mapColors={venue:'#285ea8',ground:'#33765d',airspace:'#72569a',oldAirspace:'#596779',concern:'#a96312',aircraft:'#285ea8',vessel:'#237b83',demo:'#965782',urgent:'#b43e38',neutral:'#596779'};
export function overviewKey(){return [
 {shape:'count',color:mapColors.neutral,label:'No current concern flag / screening pending',detail:'Gray does not mean cleared or safe.'},
 {shape:'count',color:mapColors.concern,label:'Potential source concern',detail:'At least one event has a finding awaiting assessment.'},
 {shape:'count',color:mapColors.urgent,label:'Urgent weather flag',detail:'At least one event has a weather alert requiring review; this is not a confirmed security threat.'}
];}
export function eventKey({nfl=true,ground=false,airspace=false,fresh=false,concerns=0,demoVessel=false}={}){
 const rows=[{shape:'dot',color:mapColors.venue,label:nfl?'Stadium location':'Event location',detail:'Mapped venue point; select for the venue name.'}];
 if(ground)rows.push({shape:'area',color:mapColors.ground,label:'Stadium outline',detail:'OpenStreetMap shape; not an approved security perimeter.'});
 if(airspace)rows.push({shape:fresh?'area':'dashed',color:fresh?mapColors.airspace:mapColors.oldAirspace,label:fresh?'FAA airspace boundary':'Older FAA airspace snapshot',detail:'Published aviation geometry; verify current notice and operating window. Not a ground perimeter.'});
 if(concerns)rows.push({shape:'dot',color:mapColors.concern,label:'Source concern location',detail:'Publisher-reported location; event impact and threat status require assessment.'});
 if(nfl)rows.push(
 {shape:'triangle',color:mapColors.aircraft,label:'Received aircraft position',detail:'OpenSky observation when connected. Line shows recent position history, not a predicted route.'},
 {shape:'triangle',color:mapColors.concern,label:'Aircraft information gap',detail:'Inside the horizontal monitoring area with missing callsign or altitude. Verify identity; not proof of hostile intent.'},
 {shape:'diamond',color:mapColors.vessel,label:'Received vessel position',detail:'AIS observation when connected, within the monitoring radius; water boundary unverified.'},
 {shape:'triangle',color:mapColors.demo,label:'Demonstration aircraft',detail:'Fictional position, visible only during the tracking replay.'},
 {shape:'dashed',color:mapColors.demo,label:'Demonstration monitoring area',detail:'Illustrative replay boundary; not an FAA restriction or approved perimeter.'});
 if(nfl&&demoVessel)rows.push({shape:'diamond',color:mapColors.demo,label:'Demonstration vessel',detail:'Fictional vessel in this replay; no real AIS transmission.'});
 return rows;
}
export function renderMapKey(target,entries,note){
 target.replaceChildren();target.className='map-key';target.setAttribute('aria-label','Map key');
 const heading=document.createElement('h5');heading.textContent='Map key';target.append(heading);
 const list=document.createElement('ul');
 for(const item of entries){const row=document.createElement('li'),symbol=document.createElement('span');symbol.className='map-key-symbol '+item.shape;symbol.style.setProperty('--symbol-color',item.color);symbol.setAttribute('aria-hidden','true');if(item.shape==='count')symbol.textContent='3';
 const text=document.createElement('div'),label=document.createElement('strong'),detail=document.createElement('span');label.textContent=item.label;detail.textContent=item.detail;text.append(label,detail);row.append(symbol,text);list.append(row);}
 target.append(list);const p=document.createElement('p');p.textContent=note;target.append(p);
}
export function trackingIcon(L,kind,color,demo=false){
 const element=document.createElement('span');element.className='track-symbol '+(kind==='aircraft'?'triangle':'diamond');element.style.setProperty('--symbol-color',color);element.setAttribute('aria-hidden','true');
 return L.divIcon({className:demo?'demo-track-marker track-map-icon':'track-map-icon',html:element,iconSize:[20,20],iconAnchor:[10,10]});
}
