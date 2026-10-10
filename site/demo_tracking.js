import {mapColors,trackingIcon} from './map_key.js?v=palette-2';
import {positionRelation,aircraftInformationAlert} from './movement_tracking.js';
export function demoTrackingFrame(game,step,now=Date.now()){
 const {lat,lon}=game.venue;
 const ring=[[lon-.015,lat-.015],[lon+.015,lat-.015],[lon+.015,lat+.015],[lon-.015,lat+.015],[lon-.015,lat-.015]];
 const phase=Math.max(0,Math.min(4,Math.floor(step)));const offsets=[-.035,-.009,.006,.035,.035];
 const track={kind:'aircraft',id:game.id+':demo-flight',label:phase===1?'Demo aircraft — identity missing':'Demo Flight 1',callsign:phase===1?null:'DEMO1',lat:lat+.004,lon:lon+offsets[phase],altitudeM:phase===1?null:1100,speedKnots:90,heading:90,observedAt:phase===4?now-121000:now,classification:'Fictional tracking example'};
 const tracks=phase===4?[]:[track];
 // A staged water-side example; no real AIS position or verified water polygon is asserted.
 if(game.venue.name==='Nissan Stadium'&&phase!==4)tracks.push({kind:'vessel',id:game.id+':demo-vessel',label:'Demo Vessel 1',callsign:'DEMO VESSEL',lat:36.167+phase*.0005,lon:-86.775,speedKnots:4,heading:10,observedAt:now,classification:'Fictional tracking example'});
 const inside=positionRelation(track,ring,game.venue),alert=aircraftInformationAlert(track,inside,now);
 return {ring,tracks,alert,phase,headline:['Identified aircraft outside the demo area','Aircraft inside demo area — information missing','Identity and altitude supplied; information gap cleared','Aircraft has left the demo area','Positions expired; markers cleared'][phase],assessment:phase===1?'Verify identity, altitude and the observation through an authorized second source. Missing data does not establish hostile intent, a drone or an airspace violation.':phase===2?'The missing-information alert is cleared because the fictional record now contains identity and altitude. This is not confirmation of authorization or event safety.':phase===4?'The example positions are older than two minutes and are removed. Expiry does not prove that an aircraft or vessel left the area.':'Position and horizontal boundary relation are observation context. Intent, authorization and governing restrictions are not established.'};
}
let active;
export function stopDemoTracking(){active?.stop();active=null;}
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function attachDemoTracking(map,controls,game){
 if(active?.map===map)return;
 stopDemoTracking();const L=window.L,layer=L.layerGroup();controls.addOverlay(layer,'Fictional tracking example');
 const panel=node('details');panel.className='demo-tracking-panel';panel.append(node('summary','Tracking demonstration — fictional aircraft and vessels'),node('p','This replay uses an illustrative observation area and fictional positions. It is separate from live tracking and the FAA overlay, and does not contribute to threat counts. A vessel example is supplied at Nissan Stadium only; its water geometry is not verified.'));
 const buttons=node('div');buttons.className='event-map-actions';const play=node('button','Play tracking story'),next=node('button','Next tracking update'),clear=node('button','Clear demo tracks');for(const b of [play,next,clear]){b.type='button';buttons.append(b);}panel.append(buttons);
 const content=node('div');content.className='demo-tracking-content';content.setAttribute('aria-live','polite');panel.append(content);
 document.querySelector('.movement-panel')?.after(panel);
 let timer,step=-1;const pause=()=>{clearInterval(timer);timer=null;play.textContent='Play tracking story';};active={map,stop(){pause();layer.clearLayers();map.removeLayer(layer);}};
 const draw=()=>{layer.clearLayers();content.replaceChildren();const frame=demoTrackingFrame(game,step);layer.addTo(map);
  content.append(node('h5',frame.headline),node('p',frame.assessment));
  if(frame.phase!==4)L.polygon(frame.ring.map(([x,y])=>[y,x]),{color:mapColors.demo,dashArray:'5 6',fillOpacity:.04}).bindPopup(node('p','Fictional observation area — not an FAA restriction or approved perimeter')).addTo(layer);
  for(const track of frame.tracks){const details=[track.label,track.kind==='aircraft'?'Callsign: '+(track.callsign||'Unavailable'):'Vessel identity: Demo Vessel 1',track.kind==='aircraft'?'Altitude: '+(track.altitudeM==null?'Unavailable':Math.round(track.altitudeM*3.28084)+' ft'):'AIS example; no real transmission', 'Speed: '+track.speedKnots+' knots','Heading: '+track.heading+'°','Fictional position; no live feed'].join(' · ');
   const marker=L.marker([track.lat,track.lon],{icon:trackingIcon(L,track.kind,mapColors.demo,true)}).bindPopup(node('p',details)).bindTooltip(track.label).addTo(layer);
   const row=node('article');row.className='movement-track-card';row.append(node('p',details));const locate=node('button','Locate '+track.label);locate.type='button';locate.onclick=()=>{map.setView([track.lat,track.lon],14);marker.openPopup();};row.append(locate);content.append(row);
  }
  if(frame.alert){const alert=node('article');alert.className='movement-information-alert';alert.setAttribute('role','alert');alert.append(node('strong','Demo information alert · '+frame.alert.title),node('p',frame.alert.detail),node('p',frame.alert.action));content.append(alert);}
  next.disabled=step>=4;
 };
 play.onclick=()=>{if(timer){pause();return;}if(step<0||step>=4)step=0;else step++;draw();map.fitBounds(demoTrackingFrame(game,0).ring.map(([x,y])=>[y,x]),{padding:[25,25],maxZoom:13});play.textContent='Pause tracking story';timer=setInterval(()=>{if(!panel.isConnected||!panel.open||panel.closest('[hidden]')){pause();return;}if(document.hidden)return;step++;draw();if(step>=4)pause();},2500);};
 next.onclick=()=>{pause();step=Math.min(step+1,4);draw();};clear.onclick=()=>{pause();step=-1;layer.clearLayers();map.removeLayer(layer);content.replaceChildren(node('p','Fictional tracks cleared. Public-source layers are unchanged.'));next.disabled=false;};
}
