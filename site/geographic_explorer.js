import {screeningPending} from './source_coverage.js?v=environment-integrity-1';
import {overviewKey,renderMapKey} from './map_key.js?v=palette-2';
import {createThreatReportButton,refreshThreatReport} from './scope_threat_report.js?v=environment-integrity-1';
import {setGeographicTrail,showWorkspaceView} from './workspace_views.js?v=multi-events-1';
// FEMA state groupings: https://www.fema.gov/about/organization/regions
export const regions={1:['CT','ME','MA','NH','RI','VT'],2:['NJ','NY','PR','VI'],3:['DE','DC','MD','PA','VA','WV'],4:['AL','FL','GA','KY','MS','NC','SC','TN'],5:['IL','IN','MI','MN','OH','WI'],6:['AR','LA','NM','OK','TX'],7:['IA','KS','MO','NE'],8:['CO','MT','ND','SD','UT','WY'],9:['AZ','CA','HI','NV','AS','GU','MP'],10:['AK','ID','OR','WA']};
const stateNames={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',AS:'American Samoa',GU:'Guam',MP:'Northern Mariana Islands',PR:'Puerto Rico',VI:'U.S. Virgin Islands'};
const stateName=code=>stateNames[code]||code;
export const stateOf=game=>game.venue?.address?.match(/,\s*([A-Z]{2}),\s*USA$/)?.[1]||null;
export const regionOf=game=>Object.keys(regions).find(id=>regions[id].includes(stateOf(game)))||null;
export const easternDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function scopeGames(games,{start,end,region,state,venue,eventType}){return games.filter(game=>{const date=easternDate(game.kickoff);return date<=end&&easternDate(game.endsAt||game.kickoff)>=start&&(!eventType||(game.eventType||'nfl')===eventType)&&(!region||regionOf(game)===region)&&(!state||stateOf(game)===state)&&(!venue||game.venue.id===venue);});}
export function rollup(games,summaries){const records=new Set();let affected=0,urgent=0,pending=0;for(const game of games){const summary=summaries.get(game.id);if(screeningPending(summary)){pending++;continue;}if(summary.items.length)affected++;if(summary.urgent.length)urgent++;for(const item of summary.items)records.add([item.sourceUrl,item.trigger,item.sourceAt].join('|'));}return {events:games.length,venues:new Set(games.map(g=>g.venue.id)).size,affected,urgent,pending,sourceConcerns:records.size};}
const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const button=(label,click)=>{const n=node('button',label);n.type='button';n.onclick=click;return n;};
export function createGeographicExplorer({openGame,onScopeChange,getChangeFeed}){
 const container=document.getElementById('map-panel');let games=[],summaries=new Map(),map,markers,signature='',scopeSignature='';
 const start=easternDate(Date.now());const end=new Date(start+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+13);
 const scope={start,end:end.toISOString().slice(0,10),region:'',state:'',venue:'',eventType:''};let currentEvent='';
 container.replaceChildren();container.append(node('h2','Event & threat overview'));
 const controls=node('div',undefined,'geo-controls');
 for(const [key,label] of [['start','From'],['end','Through']]){const wrap=node('label',label);const input=node('input');input.type='date';input.value=scope[key];input.setAttribute('aria-label',label+' event date');input.onchange=()=>{scope[key]=input.value;render();};wrap.append(input);controls.append(wrap);}
 const typeLabel=node('label','Event type');const typeSelect=node('select');typeSelect.setAttribute('aria-label','Event type');for(const [value,label] of [['','All events'],['nfl','NFL games'],['concert','Concerts'],['festival','Community festivals'],['voting','Voting locations']]){const option=node('option',label);option.value=value;typeSelect.append(option);}typeSelect.onchange=()=>{scope.eventType=typeSelect.value;scope.region=scope.state=scope.venue='';if(scope.eventType==='voting'){scope.start='2026-10-26';scope.end='2026-11-03';}else{scope.start=start;scope.end=end.toISOString().slice(0,10);}container.querySelector('[aria-label="From event date"]').value=scope.start;container.querySelector('[aria-label="Through event date"]').value=scope.end;navigate({...scope});};typeLabel.append(typeSelect);controls.append(typeLabel);
 controls.append(button('National view',()=>{scope.region=scope.state=scope.venue='';currentEvent='';history.pushState({workspaceView:'overview',geo:{...scope}},'','#overview');render();}));controls.append(createThreatReportButton(()=>({title:scope.venue?(games.find(g=>g.venue.id===scope.venue)?.venue.name||'Stadium'):scope.state?stateName(scope.state):scope.region?'FEMA Region '+scope.region:'United States',level:scope.venue?'venue':scope.state?'state':scope.region?'region':'national',games:scopeGames(games,scope),summaries,start:scope.start,end:scope.end,changeFeed:getChangeFeed?.()})));container.append(controls);

 const totals=node('div',undefined,'geo-totals');totals.setAttribute('aria-live','polite');container.append(totals);
 const layout=node('div',undefined,'geo-layout'),mapElement=node('div');mapElement.id='venue-map';mapElement.setAttribute('aria-label','Map of events in selected geographic view');const panel=node('section',undefined,'geo-selection');panel.setAttribute('aria-label','Geographic selection');layout.append(mapElement,panel);container.append(layout);const key=node('section');renderMapKey(key,overviewKey(),'The number inside each marker is the event count, not a threat count. Region and state markers group venue locations; they are not incident coordinates. Select a marker to explore that area.');container.append(key);
 const status=node('p');status.id='overview-map-status';status.setAttribute('role','status');container.append(status);
 const note=node('details'),label=node('summary','How to read this overview');note.append(label,node('p','Counts cover U.S. events for the selected dates in Eastern time. Regional and state markers group event locations; they are not incident locations. Assessed high-threat reporting is not connected. Potential concerns are source reports requiring assessment, not confirmed threats. Shared source concerns are counted once in the source total; affected games are counted separately. Gray markers have no current concern flag or are not yet assessed. FEMA regions are geographic navigation groups, not event command assignments.'));
 const source=node('a','FEMA regional organization');source.href='https://www.fema.gov/about/organization/regions';source.target='_blank';source.rel='noopener noreferrer';note.append(source);container.append(note);
 function navigate(next){Object.assign(scope,next);typeSelect.value=scope.eventType||'';container.querySelector('[aria-label="From event date"]').value=scope.start;container.querySelector('[aria-label="Through event date"]').value=scope.end;currentEvent='';showWorkspaceView('overview',{record:false});history.pushState({workspaceView:'overview',geo:{...scope}},'','#overview');render();window.scrollTo({top:0,behavior:'instant'});}
 function makeTrail(area,venueName){
  const item=(label,next)=>({label,go:()=>navigate(next)});
  const trail=[item('United States',{...area,region:'',state:'',venue:''})];
  if(area.region)trail.push(item('FEMA Region '+area.region,{...area,state:'',venue:''}));
  if(area.state)trail.push(item(stateName(area.state),{...area,venue:''}));
  if(area.venue)trail.push(item(venueName||games.find(g=>g.venue.id===area.venue)?.venue.name||'Venue',{...area}));
  return trail;
 }
 function jump(level,value){const next={...scope};if(level==='region'){next.region=value;next.state=next.venue='';}if(level==='state'){next.state=value;next.venue='';}if(level==='venue')next.venue=value;navigate(next);}
 window.addEventListener('popstate',()=>{if(history.state?.geo){Object.assign(scope,history.state.geo);typeSelect.value=scope.eventType||'';container.querySelector('[aria-label="From event date"]').value=scope.start;container.querySelector('[aria-label="Through event date"]').value=scope.end;currentEvent='';render();}else if(!history.state?.workspaceView||history.state.workspaceView==='overview'){scope.region=scope.state=scope.venue='';currentEvent='';render();}});
 function render(){
  if(!scope.start||!scope.end||scope.end<scope.start){status.textContent='Choose an end date on or after the start date.';scopeSignature='';onScopeChange?.([]);panel.replaceChildren();totals.replaceChildren();markers?.clearLayers();return;}
  status.textContent='';const selected=scopeGames(games,scope),count=rollup(selected,summaries);
  const nextScope=JSON.stringify([scope,selected.map(game=>game.id)]);if(scopeSignature!==nextScope){scopeSignature=nextScope;onScopeChange?.(selected);}
  container.querySelector('h2').textContent=scope.venue?(selected[0]?.venue.name||'Venue events'):scope.state?stateName(scope.state)+' event overview':scope.region?'FEMA Region '+scope.region+' overview':'National event overview';
  setGeographicTrail(makeTrail(scope));refreshThreatReport();
  const metrics=[{value:count.events,label:'Events in view'},{value:count.venues,label:'Venues in view'}];
  if(count.affected)metrics.push({value:count.affected,label:'Events with potential concerns',tone:'concern'});
  if(count.urgent)metrics.push({value:count.urgent,label:'Events with urgent weather concerns',tone:'urgent'});
  if(count.sourceConcerns)metrics.push({value:count.sourceConcerns,label:'Distinct source concerns',tone:'concern'});
  if(count.pending)metrics.push({value:count.pending,label:'Events awaiting screening',tone:'pending'});
  totals.replaceChildren(...metrics.map(({value,label,tone})=>{const card=node('div',undefined,'geo-total');if(tone)card.dataset.tone=tone;card.append(node('strong',String(value)),node('span',label));return card;}));
  panel.replaceChildren(node('h3',scope.venue?'Select an event':scope.state?'Select a venue':scope.region?'Select a state':'Select a FEMA region'));
  const groups=new Map();const level=scope.venue?'event':scope.state?'venue':scope.region?'state':'region';
  for(const game of selected){const key=level==='event'?game.id:level==='venue'?game.venue.id:level==='state'?stateOf(game):regionOf(game);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(game);}
  if(!selected.length)panel.append(node('p','No events in this area for the selected dates.'));
  for(const [key,items] of [...groups].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))){
   items.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));const stats=rollup(items,summaries);const title=level==='event'?items[0].title:level==='venue'?items[0].venue.name:level==='state'?stateName(key):'FEMA Region '+key;
   const select=button('',()=>{if(level==='event'){currentEvent=key;render();}else jump(level,key);});select.className='geo-choice';if(stats.urgent)select.dataset.tone='urgent';else if(stats.affected)select.dataset.tone='concern';select.append(node('strong',title),node('small',level==='event'?new Date(items[0].kickoff).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):`${stats.events} events${stats.affected?' · '+stats.affected+' with concerns':stats.pending?' · Screening pending':''}`));select.setAttribute('aria-pressed',String(currentEvent===key));panel.append(select);
  }
  if(currentEvent){const game=selected.find(g=>g.id===currentEvent);if(game){const card=node('article',undefined,'geo-event-card');card.append(node('h3',game.title),node('p',game.venue.name),node('p',summaries.get(game.id)?.label||'Assessment pending'),button('Open game briefing',()=>openGame(game.id)));panel.append(card);}}
  if(!window.L){status.textContent='Map unavailable. Use the geographic selection buttons.';return;}
  const L=window.L;if(!map){map=L.map(mapElement,{scrollWheelZoom:false,dragging:false,touchZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,zoomControl:false,zoomSnap:0});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);markers=L.layerGroup().addTo(map);new ResizeObserver(()=>{map.invalidateSize();signature='';render();}).observe(mapElement);}
  markers.clearLayers();
  const mapped=selected.filter(g=>Number.isFinite(g.venue.lat)&&Number.isFinite(g.venue.lon));
  const mappedGroups=level==='event'?new Map([[scope.venue,mapped]]):groups;
  for(const [key,items] of mappedGroups){const points=items.filter(g=>Number.isFinite(g.venue.lat)&&Number.isFinite(g.venue.lon));if(!points.length)continue;const lat=points.reduce((n,g)=>n+g.venue.lat,0)/points.length,lon=points.reduce((n,g)=>n+g.venue.lon,0)/points.length;const stats=rollup(items,summaries);const text=level==='region'?'FEMA Region '+key:level==='state'?stateName(key):points[0].venue.name;
   const marker=L.marker([lat,lon],{title:text,alt:text,icon:L.divIcon({className:'geo-marker '+(stats.urgent?'urgent':stats.affected?'concern':'neutral'),html:String(items.length),iconSize:[30,30],iconAnchor:[15,15]})});marker.bindTooltip(node('span',text+' · '+stats.events+' events'));marker.on('click',()=>{if(level==='event'){currentEvent=points[0].id;render();}else jump(level,key);});marker.addTo(markers);
  }
  const nextSignature=[scope.region,scope.state,scope.venue,scope.start,scope.end,scope.eventType].join('|');if(signature!==nextSignature){signature=nextSignature;if(!scope.region||!mapped.length)map.fitBounds([[24,-125],[50,-66]],{padding:[16,16],animate:false});else map.fitBounds(mapped.map(g=>[g.venue.lat,g.venue.lon]),{padding:[45,45],maxZoom:scope.venue?14:scope.state?8:6,animate:false});}
 }
 return {eventTrail(game){return makeTrail({...scope,region:regionOf(game)||'',state:stateOf(game)||'',venue:game.venue.id},game.venue.name);},update(nextGames,nextSummaries){games=nextGames;summaries=nextSummaries;render();}};
}
