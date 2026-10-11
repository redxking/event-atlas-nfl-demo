import {mapColors,eventKey,renderMapKey} from './map_key.js?v=palette-2';
import {attachDemoTracking} from './demo_tracking.js?v=palette-2';
import {humanText} from './attention_summary.js';
import {locatedConcerns} from './concern_location.js';
import {findingDecision} from './finding_decision.js';
import {attachMovementTracking} from './movement_map.js?v=palette-2';
let map,groundLayer,airLayer,venueLayer,controls,eventId,resizeObserver,concernLayer,concernGameId,concerns=[],keyOptions={};
const textNode=text=>{const node=document.createElement('div');node.textContent=text;return node;};
const validRing=ring=>Array.isArray(ring)&&ring.length>=4&&ring.every(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90);
export function renderEventGeographicMap(game,ground,airspace){
 const target=document.getElementById('event-geographic-map');if(!target)return;
 const status=document.getElementById('event-map-status');
 if(!window.L){status.textContent='Map could not load. Source details are available below.';return;}
 const L=window.L,venue=game.venue;
 if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)){status.textContent='Venue location is unavailable.';return;}
 if(!map||map.getContainer()!==target){
  if(map)map.remove();resizeObserver?.disconnect();
  map=L.map(target,{scrollWheelZoom:false}).setView([venue.lat,venue.lon],15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map).on('tileerror',()=>{document.getElementById('event-map-tile-status').textContent='Street map unavailable. Boundary overlays remain visible; retry when connectivity returns.';});
  groundLayer=L.layerGroup().addTo(map);airLayer=L.layerGroup().addTo(map);venueLayer=L.layerGroup().addTo(map);
  concernLayer=L.layerGroup().addTo(map);
  controls=L.control.layers(null,game.eventType&&game.eventType!=='nfl'?{'Event location':venueLayer}:{'Stadium outline':groundLayer,'FAA airspace':airLayer,'Stadium location':venueLayer},{collapsed:true}).addTo(map);
  const layerToggle=controls.getContainer().querySelector('.leaflet-control-layers-toggle');
  layerToggle.textContent='Map layers';layerToggle.setAttribute('aria-label','Map layers — show or hide map overlays');layerToggle.title='Map layers — show or hide overlays';
  controls.addOverlay(concernLayer,'Source concerns');
  L.control.scale({imperial:true,metric:true}).addTo(map);
  resizeObserver=new ResizeObserver(()=>map.invalidateSize());resizeObserver.observe(target);eventId=null;
 }
 groundLayer.clearLayers();airLayer.clearLayers();venueLayer.clearLayers();
 L.circleMarker([venue.lat,venue.lon],{radius:6,color:'#fff',weight:2,fillColor:mapColors.venue,fillOpacity:1}).bindPopup(textNode(venue.name+' — mapped stadium location')).addTo(venueLayer);
 const footprint=ground?.byVenue?.[venue.id];const rings=(footprint?.outerRings||[footprint?.ring]).filter(validRing);
 rings.forEach(ring=>L.polygon(ring.map(([lon,lat])=>[lat,lon]),{color:mapColors.ground,weight:3,fillOpacity:.22}).bindPopup(textNode('Stadium outline · OpenStreetMap. This mapped shape is not an approved security perimeter.')).addTo(groundLayer));
 const record=airspace?.byGame?.[game.id];const age=Date.now()-Date.parse(airspace?.builtAt);const fresh=Number.isFinite(age)&&age>=0&&age<43200000;
 if(validRing(record?.ring))L.polygon(record.ring.map(([lon,lat])=>[lat,lon]),{color:fresh?mapColors.airspace:mapColors.oldAirspace,weight:2,dashArray:fresh?null:'8 6',fillOpacity:.07}).bindPopup(textNode('FAA airspace · '+(fresh?'Published boundary':'Older snapshot — verify current FAA notice')+'. This is an aviation boundary, not a ground perimeter.')).addTo(airLayer);
 status.textContent=game.eventType&&game.eventType!=='nfl'?'Publisher location shown. No approved event perimeter or event-specific FAA boundary is supplied.':[rings.length?'Green: stadium outline':'Stadium outline unavailable',record?.ring?.length?(fresh?'Purple: FAA airspace':'Dashed slate: older FAA airspace snapshot'):'FAA airspace unavailable'].join(' · ');
 keyOptions={nfl:!game.eventType||game.eventType==='nfl',ground:Boolean(rings.length),airspace:validRing(record?.ring),fresh,demoVessel:venue.name==='Nissan Stadium'};
 const frame=()=>{if(validRing(record?.ring))map.fitBounds(record.ring.map(([lon,lat])=>[lat,lon]),{padding:[24,24]});else map.setView([venue.lat,venue.lon],15);};
 document.getElementById('map-show-stadium').onclick=()=>map.setView([venue.lat,venue.lon],16);
 document.getElementById('map-show-airspace').onclick=frame;
 if(!game.eventType||game.eventType==='nfl'){attachMovementTracking(map,controls,game,record?.ring);attachDemoTracking(map,controls,game);}
 if(concernGameId!==game.id){concerns=[];concernGameId=game.id;}
 drawConcerns(game);
 if(eventId!==game.id){map.setView([venue.lat,venue.lon],15);eventId=game.id;}
}

export function renderEventConcerns(game,items){
 concernGameId=game.id;concerns=locatedConcerns(items);
 if(map&&eventId===game.id)drawConcerns(game);
}
function drawConcerns(game){
 let key=document.getElementById('event-map-key');if(!key){key=document.createElement('section');key.id='event-map-key';document.getElementById('event-geographic-map').after(key);}
 renderMapKey(key,eventKey({...keyOptions,concerns:concerns.length}),'Open Map layers to show or hide overlays. Tracking symbols appear only when positions are received or the demonstration is playing. Select a marker for its source and details. Colors describe record types and review needs, not a confirmed threat rating.');
 concernLayer.clearLayers();
 for(const cue of concerns){
  const content=document.createElement('div');content.className='concern-map-popup';
  const add=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;content.append(n);};
  add('strong',cue.trigger);add('p','Publisher location · event impact requires verification');
  add('p',humanText(cue.basis));add('p','Reported: '+(cue.sourceAt?new Date(cue.sourceAt).toLocaleString():'Time not supplied'));
  add('p','Next step: '+findingDecision(cue).verify);
  const link=document.createElement('a');link.textContent='Review source';link.href=cue.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';content.append(link);
  const marker=window.L.circleMarker([cue.location.lat,cue.location.lon],{className:'source-concern-marker',radius:9,color:mapColors.concern,weight:2,fillColor:mapColors.concern,fillOpacity:.95}).bindTooltip(cue.trigger).bindPopup(content).addTo(concernLayer);
  const makeAccessible=()=>{const shape=marker.getElement();if(!shape)return;shape.setAttribute('tabindex','0');shape.setAttribute('role','button');shape.setAttribute('aria-label',cue.trigger+' — review source concern');shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();marker.openPopup();}});};marker.on('add',makeAccessible);makeAccessible();
 }
 let button=document.getElementById('map-show-concerns');
 if(!button){button=document.createElement('button');button.id='map-show-concerns';button.type='button';document.querySelector('.event-map-actions')?.append(button);}
 button.hidden=!concerns.length;button.textContent='Show source concerns ('+concerns.length+')';
 button.onclick=()=>map.fitBounds([[game.venue.lat,game.venue.lon],...concerns.map(c=>[c.location.lat,c.location.lon])],{padding:[30,30],maxZoom:15});
}
