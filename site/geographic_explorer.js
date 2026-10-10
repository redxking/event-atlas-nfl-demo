// FEMA state groupings: https://www.fema.gov/about/organization/regions
export const regions={1:['CT','ME','MA','NH','RI','VT'],2:['NJ','NY','PR','VI'],3:['DE','DC','MD','PA','VA','WV'],4:['AL','FL','GA','KY','MS','NC','SC','TN'],5:['IL','IN','MI','MN','OH','WI'],6:['AR','LA','NM','OK','TX'],7:['IA','KS','MO','NE'],8:['CO','MT','ND','SD','UT','WY'],9:['AZ','CA','HI','NV','AS','GU','MP'],10:['AK','ID','OR','WA']};
export const stateOf=game=>game.venue?.address?.match(/,\s*([A-Z]{2}),\s*USA$/)?.[1]||null;
export const regionOf=game=>Object.keys(regions).find(id=>regions[id].includes(stateOf(game)))||null;
export const easternDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function scopeGames(games,{start,end,region,state,venue}){return games.filter(game=>{const date=easternDate(game.kickoff);return date>=start&&date<=end&&(!region||regionOf(game)===region)&&(!state||stateOf(game)===state)&&(!venue||game.venue.id===venue);});}
export function rollup(games,summaries){const records=new Set();let affected=0,urgent=0,pending=0;for(const game of games){const summary=summaries.get(game.id);if(!summary||summary.label==='Monitoring not started'){pending++;continue;}if(summary.items.length)affected++;if(summary.urgent.length)urgent++;for(const item of summary.items)records.add([item.sourceUrl,item.trigger,item.sourceAt].join('|'));}return {events:games.length,venues:new Set(games.map(g=>g.venue.id)).size,affected,urgent,pending,sourceConcerns:records.size};}
const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const button=(label,click)=>{const n=node('button',label);n.type='button';n.onclick=click;return n;};
export function createGeographicExplorer({openGame,onScopeChange}){
 const container=document.getElementById('map-panel');let games=[],summaries=new Map(),map,markers,signature='',scopeSignature='';
 const start=easternDate(Date.now());const end=new Date(start+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+13);
 const scope={start,end:end.toISOString().slice(0,10),region:'',state:'',venue:''};let currentEvent='';
 container.replaceChildren();container.append(node('h2','Event & threat overview'));
 const controls=node('div',undefined,'geo-controls');
 for(const [key,label] of [['start','From'],['end','Through']]){const wrap=node('label',label);const input=node('input');input.type='date';input.value=scope[key];input.setAttribute('aria-label',label+' event date');input.onchange=()=>{scope[key]=input.value;render();};wrap.append(input);controls.append(wrap);}
 controls.append(button('National view',()=>{scope.region=scope.state=scope.venue='';currentEvent='';render();}));container.append(controls);
 const breadcrumb=node('nav');breadcrumb.setAttribute('aria-label','Geographic navigation');container.append(breadcrumb);
 const totals=node('div',undefined,'geo-totals');totals.setAttribute('aria-live','polite');container.append(totals);
 const layout=node('div',undefined,'geo-layout'),mapElement=node('div');mapElement.id='venue-map';mapElement.setAttribute('aria-label','Map of events in selected geographic view');const panel=node('section',undefined,'geo-selection');panel.setAttribute('aria-label','Geographic selection');layout.append(mapElement,panel);container.append(layout);
 const status=node('p');status.id='overview-map-status';status.setAttribute('role','status');container.append(status);
 const note=node('details'),label=node('summary','How to read this overview');note.append(label,node('p','Counts cover U.S. NFL games for the selected dates in Eastern time. Regional and state markers group event locations; they are not incident locations. Assessed high-threat reporting is not connected. Potential concerns are source reports requiring assessment, not confirmed threats. Shared source concerns are counted once in the source total; affected games are counted separately. Gray markers have no current concern flag or are not yet assessed. FEMA regions are geographic navigation groups, not event command assignments.'));
 const source=node('a','FEMA regional organization');source.href='https://www.fema.gov/about/organization/regions';source.target='_blank';source.rel='noopener noreferrer';note.append(source);container.append(note);
 function jump(level,value){if(level==='region'){scope.region=value;scope.state=scope.venue='';}if(level==='state'){scope.state=value;scope.venue='';}if(level==='venue')scope.venue=value;currentEvent='';render();}
 function render(){
  if(!scope.start||!scope.end||scope.end<scope.start){status.textContent='Choose an end date on or after the start date.';scopeSignature='';onScopeChange?.([]);panel.replaceChildren();totals.replaceChildren();markers?.clearLayers();return;}
  status.textContent='';const selected=scopeGames(games,scope),count=rollup(selected,summaries);
  const nextScope=JSON.stringify([scope,selected.map(game=>game.id)]);if(scopeSignature!==nextScope){scopeSignature=nextScope;onScopeChange?.(selected);}
  breadcrumb.replaceChildren(button('United States',()=>{scope.region=scope.state=scope.venue='';currentEvent='';render();}));
  if(scope.region)breadcrumb.append(node('span',' › '),button('FEMA Region '+scope.region,()=>jump('region',scope.region)));
  if(scope.state)breadcrumb.append(node('span',' › '),button(scope.state,()=>jump('state',scope.state)));
  if(scope.venue)breadcrumb.append(node('span',' › '+(selected[0]?.venue.name||'Venue')));
  totals.replaceChildren(...[`${count.events} events`,`${count.venues} venues`,`${count.affected} games with potential concerns`,`${count.urgent} games with urgent weather concerns`,`${count.sourceConcerns} distinct source concerns`,`${count.pending} games awaiting screening`].map(text=>node('span',text)));
  panel.replaceChildren(node('h3',scope.venue?'Select an event':scope.state?'Select a venue':scope.region?'Select a state':'Select a FEMA region'));
  const groups=new Map();const level=scope.venue?'event':scope.state?'venue':scope.region?'state':'region';
  for(const game of selected){const key=level==='event'?game.id:level==='venue'?game.venue.id:level==='state'?stateOf(game):regionOf(game);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(game);}
  if(!selected.length)panel.append(node('p','No events in this area for the selected dates.'));
  for(const [key,items] of [...groups].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))){
   items.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));const stats=rollup(items,summaries);const title=level==='event'?items[0].title:level==='venue'?items[0].venue.name:level==='state'?key:'FEMA Region '+key;
   const select=button('',()=>{if(level==='event'){currentEvent=key;render();}else jump(level,key);});select.className='geo-choice';select.append(node('strong',title),node('small',level==='event'?new Date(items[0].kickoff).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):`${stats.events} events · ${stats.affected} with concerns`));select.setAttribute('aria-pressed',String(currentEvent===key));panel.append(select);
  }
  if(currentEvent){const game=selected.find(g=>g.id===currentEvent);if(game){const card=node('article',undefined,'geo-event-card');card.append(node('h3',game.title),node('p',game.venue.name),node('p',summaries.get(game.id)?.label||'Assessment pending'),button('Open game briefing',()=>openGame(game.id)));panel.append(card);}}
  if(!window.L){status.textContent='Map unavailable. Use the geographic selection buttons.';return;}
  const L=window.L;if(!map){map=L.map(mapElement,{scrollWheelZoom:false,dragging:false,touchZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,zoomControl:false,zoomSnap:0});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);markers=L.layerGroup().addTo(map);new ResizeObserver(()=>{map.invalidateSize();signature='';render();}).observe(mapElement);}
  markers.clearLayers();
  const mapped=selected.filter(g=>Number.isFinite(g.venue.lat)&&Number.isFinite(g.venue.lon));
  const mappedGroups=level==='event'?new Map([[scope.venue,mapped]]):groups;
  for(const [key,items] of mappedGroups){const points=items.filter(g=>Number.isFinite(g.venue.lat)&&Number.isFinite(g.venue.lon));if(!points.length)continue;const lat=points.reduce((n,g)=>n+g.venue.lat,0)/points.length,lon=points.reduce((n,g)=>n+g.venue.lon,0)/points.length;const stats=rollup(items,summaries);const text=level==='region'?'FEMA Region '+key:level==='state'?key:points[0].venue.name;
   const marker=L.marker([lat,lon],{title:text,alt:text,icon:L.divIcon({className:'geo-marker '+(stats.urgent?'urgent':stats.affected?'concern':'neutral'),html:String(items.length),iconSize:[30,30],iconAnchor:[15,15]})});marker.bindTooltip(node('span',text+' · '+stats.events+' events'));marker.on('click',()=>{if(level==='event'){currentEvent=points[0].id;render();}else jump(level,key);});marker.addTo(markers);
  }
  const nextSignature=[scope.region,scope.state,scope.venue,scope.start,scope.end].join('|');if(signature!==nextSignature){signature=nextSignature;if(!scope.region||!mapped.length)map.fitBounds([[24,-125],[50,-66]],{padding:[16,16],animate:false});else map.fitBounds(mapped.map(g=>[g.venue.lat,g.venue.lon]),{padding:[45,45],maxZoom:scope.venue?14:scope.state?8:6,animate:false});}
 }
 return {update(nextGames,nextSummaries){games=nextGames;summaries=nextSummaries;render();}};
}
