import {attachMovementTracking} from './movement_map.js?v=multi-events-1';
let map,groundLayer,airLayer,venueLayer,controls,eventId,resizeObserver;
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
  controls=L.control.layers(null,game.eventType&&game.eventType!=='nfl'?{'Event location':venueLayer}:{'Stadium outline':groundLayer,'FAA airspace':airLayer,'Stadium location':venueLayer},{collapsed:false}).addTo(map);
  L.control.scale({imperial:true,metric:true}).addTo(map);
  resizeObserver=new ResizeObserver(()=>map.invalidateSize());resizeObserver.observe(target);eventId=null;
 }
 groundLayer.clearLayers();airLayer.clearLayers();venueLayer.clearLayers();
 L.circleMarker([venue.lat,venue.lon],{radius:6,color:'#fff',weight:2,fillColor:'#1464db',fillOpacity:1}).bindPopup(textNode(venue.name+' — mapped stadium location')).addTo(venueLayer);
 const footprint=ground?.byVenue?.[venue.id];const rings=(footprint?.outerRings||[footprint?.ring]).filter(validRing);
 rings.forEach(ring=>L.polygon(ring.map(([lon,lat])=>[lat,lon]),{color:'#147766',weight:3,fillOpacity:.22}).bindPopup(textNode('Stadium outline · OpenStreetMap. This mapped shape is not an approved security perimeter.')).addTo(groundLayer));
 const record=airspace?.byGame?.[game.id];const age=Date.now()-Date.parse(airspace?.builtAt);const fresh=Number.isFinite(age)&&age>=0&&age<43200000;
 if(validRing(record?.ring))L.polygon(record.ring.map(([lon,lat])=>[lat,lon]),{color:fresh?'#7356bf':'#9a6b20',weight:2,dashArray:fresh?null:'8 6',fillOpacity:.07}).bindPopup(textNode('FAA airspace · '+(fresh?'Published boundary':'Older snapshot — verify current FAA notice')+'. This is an aviation boundary, not a ground perimeter.')).addTo(airLayer);
 status.textContent=game.eventType&&game.eventType!=='nfl'?'Publisher location shown. No approved event perimeter or event-specific FAA boundary is supplied.':[rings.length?'Green: stadium outline':'Stadium outline unavailable',record?.ring?.length?(fresh?'Purple: FAA airspace':'Dashed amber: older FAA airspace snapshot'):'FAA airspace unavailable'].join(' · ');
 const frame=()=>{if(validRing(record?.ring))map.fitBounds(record.ring.map(([lon,lat])=>[lat,lon]),{padding:[24,24]});else map.setView([venue.lat,venue.lon],15);};
 document.getElementById('map-show-stadium').onclick=()=>map.setView([venue.lat,venue.lon],16);
 document.getElementById('map-show-airspace').onclick=frame;
 if(!game.eventType||game.eventType==='nfl')attachMovementTracking(map,controls,game,record?.ring);
 if(eventId!==game.id){map.setView([venue.lat,venue.lon],15);eventId=game.id;}
}
