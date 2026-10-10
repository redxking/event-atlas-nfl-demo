import {pointInsideRing} from './ground_relevance.js';
export function normalizeAircraft(payload,now=Date.now()){
 if(!Number.isFinite(payload?.time)||now-payload.time*1000>120000||payload.time*1000>now+30000)return [];
 return (payload.states||[]).filter(s=>typeof s[0]==='string'&&Number.isFinite(s[3])&&now-s[3]*1000<=120000&&s[3]*1000<=now+30000&&Number.isFinite(s[5])&&Math.abs(s[5])<=180&&Number.isFinite(s[6])&&Math.abs(s[6])<=90&&s[8]===false).map(s=>({id:s[0],callsign:typeof s[1]==='string'&&s[1].trim()?s[1].trim():null,label:typeof s[1]==='string'&&s[1].trim()?s[1].trim():'Unidentified callsign',lon:s[5],lat:s[6],observedAt:s[3]*1000,altitudeM:Number.isFinite(s[7])?s[7]:null,speedKnots:Number.isFinite(s[9])?s[9]*1.943844:null,heading:Number.isFinite(s[10])?s[10]:null,kind:'aircraft'}));
}
export function distanceM(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
export function positionRelation(track,ring,venue){return track.kind==='vessel'?distanceM(track,venue)<=5000:Array.isArray(ring)&&ring.length>=4?pointInsideRing(track,ring):null;}
export function movementTransition(previous,current,inside){if(inside===null)return 'Boundary unavailable';if(!previous||current.observedAt-previous.observedAt>120000)return inside?'First observed inside':'Outside monitored area';if(current.observedAt<=previous.observedAt)return previous.state;return previous.inside===false&&inside?'Observed entering':previous.inside===true&&!inside?'Observed leaving':inside?'Inside monitored area':'Outside monitored area';}

export function aircraftInformationAlert(track,inside,now=Date.now()){
 if(track.kind!=='aircraft'||inside!==true||!Number.isFinite(track.observedAt)||now-track.observedAt>120000||track.observedAt>now+30000)return null;
 const missing=[];if(!track.callsign)missing.push('callsign');if(!Number.isFinite(track.altitudeM))missing.push('altitude');
 if(!missing.length)return null;
 return {id:'aircraft-info:'+track.id,title:!track.callsign?'Aircraft inside area — callsign unavailable':'Aircraft inside area — altitude unavailable',missing,detail:'The received position is inside the horizontal monitoring boundary. Missing '+missing.join(' and ')+'. This is an information-gap alert, not evidence of hostile intent or a restriction violation.',action:'Check a second authorized tracking source and current airspace conditions. If other concerning evidence exists, follow the venue response plan.'};
}
