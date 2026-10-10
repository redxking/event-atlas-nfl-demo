import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {saveReconciledEventSnapshot} from '../lib/event_snapshot.mjs';
import {pointInsideRing} from '../site/ground_relevance.js';
import {nflSourceStatus} from '../lib/nfl_game_lifecycle.mjs';
import {nflScoreboardState} from '../lib/nfl_scoreboard_state.mjs';
const venues=JSON.parse(await fs.readFile('data/venues.json','utf8')).venues;
const nflVenueCandidates=JSON.parse(await fs.readFile('data/nfl_venue_candidates.json','utf8'));
const groundFootprints=JSON.parse(await fs.readFile('site/ground_footprints.json','utf8'));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const byName=new Map();for(const v of venues){const k=norm(v.name);let x=byName.get(k)||[];x.push(v);byName.set(k,x)}
const start=new Date(),end=new Date(start.getTime()+30*86400000),ymd=d=>d.toISOString().slice(0,10);
const sources=[{id:'nfl',name:'2026 NFL regular season via ESPN scoreboard',dataset:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',status:'ok',records:0},{id:'mlb',name:'Major League Baseball schedule',dataset:'https://statsapi.mlb.com/api/v1/schedule',status:'ok',records:0},{id:'nhl',name:'National Hockey League schedule',dataset:'https://api-web.nhle.com/v1/schedule/',status:'ok',records:0}];
const events=[];const places=new Map();
function add({id,title,startsAtLocal,timeZone,sourceId,sourceUrl,sourceDataset,placeName,placeAddress=null,category,description,participants,status,timeTbd=false,sourceVenueId=null,gameState=null}){
  if(!startsAtLocal||!placeName)return;
  const candidates=byName.get(norm(placeName))||[];
  const explicit=sourceId==='nfl'&&nflVenueCandidates[sourceVenueId];
  const checked=explicit?.name===placeName&&explicit?.sourceAddress===placeAddress?explicit:null;
  const candidate=candidates.length===1?candidates[0]:checked;
  let lat=candidate?.lat??null,lon=candidate?.lon??null;
  let coordinateSource=candidate?.coordinateSource||(candidate?'Wikidata name-match candidate':null);
  const footprint=sourceId==='nfl'&&sourceVenueId==='7065'&&groundFootprints.byVenue?.['7065'];
  if(footprint?.osmId===860635712&&footprint.wikidata===candidate?.id&&!pointInsideRing({lat,lon},footprint.ring)){
    const vertices=footprint.ring.slice(0,-1);
    const center=vertices.reduce((sum,[x,y])=>[sum[0]+x,sum[1]+y],[0,0]).map(value=>value/vertices.length);
    if(pointInsideRing({lon:center[0],lat:center[1]},footprint.ring)){
      lon=center[0];lat=center[1];
      coordinateSource='OpenStreetMap way 860635712 geometry-derived point candidate; Wikidata point conflict; unreviewed';
    }
  }
  const key=`${sourceId}|${sourceVenueId||norm(placeName)}`;
  const placeId='place:'+crypto.createHash('sha256').update(key).digest('hex').slice(0,16);
  if(!places.has(placeId))places.set(placeId,{id:placeId,name:placeName,address:placeAddress,lat,lon,coordinateSource,sourceIds:[sourceId],sourceVenueId,venueCandidateId:candidate?.id??null,matchStatus:candidate?'unreviewed unique-name candidate':'unlinked'});
  events.push({id,title,startsAtLocal,endsAtLocal:null,timeZone,sourceId,sourceUrl,sourceDataset,sourcePlace:{name:placeName,address:placeAddress,lat,lon},placeId,venueId:candidate?.id??null,venueLinkStatus:candidate?'unreviewed unique-name candidate':'unlinked',category,description,timeTbd,gameState,organizer:sourceId==='nfl'?'National Football League':sourceId==='mlb'?'Major League Baseball':'National Hockey League',participants,status,retrievedAt:new Date().toISOString()});
}
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'EventAtlas/0.2 (public sports schedule evaluation)'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
try{
  const weeks=await Promise.all(Array.from({length:18},(_,i)=>{const week=i+1,url=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${week}&limit=100`;return get(url).then(data=>({week,url,data}))}));
  const ids=new Set();let excludedInternational=0;
  for(const {week,url,data} of weeks){
    if(!Array.isArray(data.events)||data.events.length<10||data.events.length>20)throw Error(`NFL week ${week} returned ${data.events?.length??'no'} games`);
    for(const game of data.events){
      const competition=game.competitions?.[0],venue=competition?.venue,competitors=competition?.competitors||[];
      if(!game.id||!game.date||!venue?.id||!venue.fullName||competitors.length!==2)throw Error(`NFL week ${week} has incomplete event ${game.id||'unknown'}`);
      if(ids.has(game.id))throw Error(`NFL duplicate game ${game.id}`);ids.add(game.id);
      if(!['USA','US','United States'].includes(venue.address?.country)){excludedInternational++;continue}
      const home=competitors.find(c=>c.homeAway==='home')?.team?.displayName,away=competitors.find(c=>c.homeAway==='away')?.team?.displayName;
      if(!home||!away)throw Error(`NFL game ${game.id} missing teams`);
      const address=[venue.address?.city,venue.address?.state,venue.address?.country].filter(Boolean).join(', ');
      add({id:`nfl:${game.id}`,title:`${away} at ${home}`,startsAtLocal:game.date,timeZone:'UTC',sourceId:'nfl',sourceUrl:game.links?.find(l=>l.rel?.includes('summary'))?.href||`https://www.espn.com/nfl/game/_/gameId/${game.id}`,sourceDataset:url,sourceVenueId:String(venue.id),placeName:venue.fullName,placeAddress:address,category:`NFL regular season · week ${week}`,description:`ESPN scoreboard status: ${game.status?.type?.description||'not supplied'}; neutral site: ${competition.neutralSite?'yes':'no'}`,participants:[{type:'team',name:away,role:'away'},{type:'team',name:home,role:'home'}],status:nflSourceStatus(game.status?.type),timeTbd:/TBD/i.test(game.status?.type?.shortDetail||''),gameState:nflScoreboardState(game,competition)});
    }
  }
  if(ids.size!==272)throw Error(`NFL season returned ${ids.size} games, expected 272`);
  sources[0].records=events.filter(e=>e.sourceId==='nfl').length;
  sources[0].excludedInternational=excludedInternational;
  sources[0].reportedTotal=ids.size;
}catch(e){sources[0].status='failed';sources[0].error=String(e);for(let i=events.length-1;i>=0;i--)if(events[i].sourceId==='nfl')events.splice(i,1);for(const [id,place] of places)if(place.sourceIds.includes('nfl'))places.delete(id)}
try{const url=`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${ymd(start)}&endDate=${ymd(end)}&hydrate=venue,team`;const data=await get(url);for(const day of data.dates||[])for(const g of day.games||[]){if(!g.gameDate||!g.venue?.name||g.teams?.home?.team?.id===141)continue;const away=g.teams?.away?.team?.name||'Away',home=g.teams?.home?.team?.name||'Home';add({id:`mlb:${g.gamePk}`,title:`${away} at ${home}`,startsAtLocal:g.gameDate,timeZone:'UTC',sourceId:'mlb',sourceUrl:`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`,sourceDataset:url,placeName:g.venue.name,category:'MLB game',description:`Official date ${g.officialDate||'unspecified'}; status ${g.status?.detailedState||'unspecified'}`,participants:[{type:'team',name:away,role:'away'},{type:'team',name:home,role:'home'}],status:g.status?.abstractGameState==='Final'?'completed in source':'scheduled in source; unreviewed'})}sources[1].records=events.filter(e=>e.sourceId==='mlb').length}catch(e){sources[1].status='failed';sources[1].error=String(e)}
try{for(let week=0;week<5;week++){const d=new Date(start.getTime()+week*7*86400000),url=`https://api-web.nhle.com/v1/schedule/${ymd(d)}`;const data=await get(url);for(const day of data.gameWeek||[])for(const g of day.games||[]){if(!g.startTimeUTC||!g.venue?.default||[8,9,10,20,22,23,52].includes(g.homeTeam?.id)||g.neutralSite)continue;const away=[g.awayTeam?.placeName?.default,g.awayTeam?.commonName?.default].filter(Boolean).join(' '),home=[g.homeTeam?.placeName?.default,g.homeTeam?.commonName?.default].filter(Boolean).join(' ');add({id:`nhl:${g.id}`,title:`${away} at ${home}`,startsAtLocal:g.startTimeUTC,timeZone:'UTC',sourceId:'nhl',sourceUrl:`https://www.nhl.com/gamecenter/${g.id}`,sourceDataset:url,placeName:g.venue.default,category:'NHL game',description:`Schedule state ${g.gameScheduleState||'unspecified'}; game state ${g.gameState||'unspecified'}`,participants:[{type:'team',name:away,role:'away'},{type:'team',name:home,role:'home'}],status:g.gameScheduleState==='OK'?'scheduled in source; unreviewed':`source status ${g.gameScheduleState||'unknown'}`})}}sources[2].records=events.filter(e=>e.sourceId==='nhl').length}catch(e){sources[2].status='failed';sources[2].error=String(e)}
const unique=new Map(events.map(e=>[e.id,e]));const candidate={retrievedAt:new Date().toISOString(),fromDate:ymd(start),throughDate:ymd(end),coverageNote:'2026 NFL regular-season US games from the public ESPN scoreboard, plus official MLB and NHL schedules for the next 30 days. International NFL games are excluded from this US venue demo. Team participants are organizations, not verified individual attendance. Wikidata venue name matches are unreviewed coordinate candidates, not verified entrances.',sources,places:[...places.values()],events:[...unique.values()]};const out=await saveReconciledEventSnapshot('data/sports_events.json',candidate);console.log(sources.map(s=>[s.id,s.status,s.records]),'total',out.events.length,'venue candidates',out.events.filter(e=>e.venueId).length,'changes',out.changeSet.items.length);
