import http from 'node:http';import fs from 'node:fs/promises';
import {normalizeAircraft,distanceM} from '../site/movement_tracking.js';
const games=JSON.parse(await fs.readFile(new URL('../site/nfl.json',import.meta.url))).games;const venues=new Map(games.map(g=>[g.venue.id,g.venue]));const cache=new Map();const port=49388;
let aisSocket,aisVenue,aisState='not_connected',aisLastUse=0,aisRetryAt=0;const ships=new Map();
function connectAis(venue){
 aisLastUse=Date.now();if(!process.env.AISSTREAM_API_KEY)return;
 if(aisVenue===venue.id&&aisSocket&&[0,1].includes(aisSocket.readyState))return;if(Date.now()<aisRetryAt)return;
 aisSocket?.close();ships.clear();aisVenue=venue.id;aisState='connecting';aisRetryAt=Date.now()+10000;
 const socket=aisSocket=new WebSocket('wss://stream.aisstream.io/v0/stream');socket.binaryType='arraybuffer';
 socket.onopen=()=>{const dlat=.06,dlon=.06/Math.cos(venue.lat*Math.PI/180);socket.send(JSON.stringify({APIKey:process.env.AISSTREAM_API_KEY,BoundingBoxes:[[[venue.lat-dlat,venue.lon-dlon],[venue.lat+dlat,venue.lon+dlon]]],FilterMessageTypes:['PositionReport','StandardClassBPositionReport','ExtendedClassBPositionReport']}));};
 socket.onmessage=event=>{if(socket!==aisSocket)return;try{const data=JSON.parse(typeof event.data==='string'?event.data:new TextDecoder().decode(event.data));if(data.MessageType==='SubscriptionConfirmation'){aisState='connected';return;}if(data.error||data.Error){aisState='unavailable';socket.close();return;}
 const meta=data.MetaData,position=data.Message?.[data.MessageType];if(!meta||!position||position.Valid===false)return;const lat=position.Latitude??meta.Latitude,lon=position.Longitude??meta.Longitude;if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)return;
 const stamp=Date.parse(meta.time_utc);if(!Number.isFinite(stamp)||Date.now()-stamp>120000||stamp>Date.now()+30000)return;
 const id=String(meta.MMSI||position.UserID);if(!/^\d{9}$/.test(id)||distanceM({lat,lon},venue)>7000)return;
 ships.set(id,{id,label:String(meta.ShipName||'Vessel '+id).trim(),lat,lon,observedAt:stamp,kind:'vessel',speedKnots:Number.isFinite(position.Sog)&&position.Sog<102.3?position.Sog:null,heading:Number.isFinite(position.Cog)&&position.Cog<360?position.Cog:null});aisState='connected';
 }catch{aisState='invalid_message';}};
 socket.onerror=()=>{if(socket===aisSocket)aisState='unavailable';};socket.onclose=()=>{if(socket===aisSocket)aisState='disconnected';};
}
setInterval(()=>{if(aisSocket&&Date.now()-aisLastUse>90000){aisSocket.close();aisSocket=null;aisState='idle';ships.clear();}},30000).unref();
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;const allowed=['http://127.0.0.1:49386','http://localhost:49386','http://127.0.0.1:49387','http://localhost:49387'];
 const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(value));};
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)||(origin&&!allowed.includes(origin)))return send(403,{error:'Origin not allowed'});
 const u=new URL(req.url,'http://127.0.0.1:'+port),venue=venues.get(u.searchParams.get('venue'));if(req.method!=='GET'||u.pathname!=='/tracks'||!venue||!Number.isFinite(venue.lat))return send(400,{error:'Select a known venue'});
 connectAis(venue);
 let entry=cache.get(venue.id);if(!entry||Date.now()-entry.at>30000){
 const at=Date.now(),promise=(async()=>{try{const dlat=.18,dlon=.18/Math.cos(venue.lat*Math.PI/180);const url=new URL('https://opensky-network.org/api/states/all');for(const [k,v]of Object.entries({lamin:venue.lat-dlat,lamax:venue.lat+dlat,lomin:venue.lon-dlon,lomax:venue.lon+dlon}))url.searchParams.set(k,v);const response=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)return {status:response.status===429?'rate_limited':'unavailable',tracks:[]};const payload=await response.json();return {status:Number.isFinite(payload.time)&&Date.now()-payload.time*1000<=120000&&payload.time*1000<=Date.now()+30000?'connected':'stale',sourceTime:payload.time*1000,tracks:normalizeAircraft(payload)};}catch{return {status:'unavailable',tracks:[]};}})();entry={at,promise};cache.set(venue.id,entry);}
 const aircraft=await entry.promise;return send(200,{venueId:venue.id,checkedAt:Date.now(),aircraft:{...aircraft,provider:'OpenSky',retrievedAt:entry.at},vessels:{provider:'AISStream',status:aisVenue===venue.id?aisState:'not_connected',tracks:aisVenue===venue.id?[...ships.values()].filter(s=>Date.now()-s.observedAt<=120000):[]},faa:{status:'not_connected'}});
}).listen(port,'127.0.0.1',()=>console.log('Local movement bridge listening on 127.0.0.1:'+port));
