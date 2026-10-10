import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publishedNflReportMode} from '../lib/nfl_game_lifecycle.mjs';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildPublishedReportState} from '../site/published_report_changes.js';
import {buildPublishedChangeFeed,renderPublishedChangeAtom} from '../lib/published_change_feed.mjs';
import {mbtaFoxboroAlertsUrl,summarizeMbtaFoxboroAlerts} from '../site/mbta_foxboro_alerts.js';
import {mbtaFoxboroSchedulesUrl,summarizeMbtaFoxboroSchedules} from '../site/mbta_foxboro_schedules.js';
import {fetchSelectedGame} from '../site/espn_game_summary.js';
import {fetchNwsStationObservation} from '../site/nws_observation.js';
import {renderPublicReportHtml} from './render_public_report_html.mjs';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const read=async name=>{try{return JSON.parse(await fs.readFile(path.join(site,name),'utf8'))}catch{return null}};
const required=await read('nfl.json');
const now=Date.now();
if(required?.source?.status!=='ok'||!Array.isArray(required.games)||!Number.isFinite(Date.parse(required.builtAt))||now-Date.parse(required.builtAt)>12*3600000)throw Error('Fresh NFL schedule snapshot required for published reports');
const names={ground:'ground_footprints.json',airspace:'seams.json',tfr:'tfr.json',cameras:'cameras.json',roads:'roads.json',spc:'spc_outlooks.json',wpcRain:'wpc_rain_outlooks.json',eonet:'eonet.json',nifc:'nifc_wildfire.json',airnow:'airnow_pm25.json',hmsSmoke:'hms_smoke.json',news:'news.json',gameArticles:'game_articles.json',ntas:'ntas.json',spaceWeather:'noaa_space_weather.json',septa:'septa_b_alerts.json',njTransitRail:'njtransit_event_rail.json',nj511:'nj511_events.json',indianapolisPolice:'indianapolis_public_safety.json',charlottePolice:'charlotte_public_safety.json',arlingtonPolice:'arlington_public_safety.json',denverPolice:'denver_public_safety.json',phillyAlerts:'philly_city_alerts.json',phillyPermits:'philly_lane_permits.json',greenBayAlerts:'green_bay_alerts.json',lambeauPlan:'lambeau_gameday.json',packersGameRelease:'packers_game_release.json',patriotsGamePreview:'patriots_game_preview.json',jetsGamedayGuide:'jets_gameday_guide.json',seahawksGameday:'seahawks_gameday.json',titansGameday:'titans_gameday.json',falconsGameday:'falcons_gameday.json',commandersGameday:'commanders_gameday.json',dolphinsCrucialCatch:'dolphins_crucial_catch.json',saintsGameday:'saints_gameday.json',nolaReadyEvent:'nola_ready_event.json',nolaReadyActive:'nola_ready_active.json',nolaReadyUpdates:'nola_ready_updates.json',nolaReadyRegional:'nola_ready_regional.json',nortaAlerts:'norta_alerts.json',nolaPublicCalls:'nola_public_calls.json',martaRail:'marta_rail.json',martaAlertPreview:'marta_alert_preview.json',georgiaTraffic:'georgia_traffic.json',soundTransitSeahawks:'sound_transit_seahawks.json',soundTransitAlerts:'sound_transit_alerts.json',seattleFireAggregate:'seattle_fire_aggregate.json',nashvillePoliceCount:'nashville_police_count.json'};
const inputs={schedule:required};
for(const [key,name] of Object.entries(names))inputs[key]=await read(name);
const games=required.games.filter(game=>publishedNflReportMode(game,now));
if(games.length>300)throw Error('Unexpectedly many NFL games in the season report set');
const headers={Accept:'application/geo+json, application/json','User-Agent':'EventAtlas NFL public report (https://github.com/redxking/event-atlas-nfl-demo)'};
const nwsHost=/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3,4}\/\d+,\d+\/forecast\/hourly$/;
const fetchJson=async url=>{
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  return response.json();
};
let quakes=null,quakesError=null;
try{
  quakes=await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
  if(quakes?.type!=='FeatureCollection'||!Array.isArray(quakes.features)||quakes.features.length>10000)throw Error('Invalid USGS collection');
}catch(error){quakes=null;quakesError=`USGS ${String(error.message).slice(0,100)}`}
const venueChecks=new Map();
function publishedPolice(game){
  const feed=game.venue.id==='3812'?inputs.indianapolisPolice:game.venue.id==='3628'?inputs.charlottePolice:game.venue.id==='3687'?inputs.arlingtonPolice:game.venue.id==='3937'?inputs.denverPolice:null;
  if(!feed)return null;
  const checkedAt=Date.parse(feed.builtAt),context=feed.byVenue?.[game.venue.id];
  if(feed.status!=='ok'||!context||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>(game.venue.id==='3687'?2:12)*3600000)return {state:'failed'};
  return {state:'retrieved',checkedAt,context,sourceId:feed.sourceId};
}
async function publishedMbta(game){
  if(game.venue.id!=='3738')return {transit:null,transitSchedule:null};
  const retrieve=async (url,summarize)=>{
    try{return summarize(await fetchJson(url),game,Date.now())}
    catch{return {state:'failed',checkedAt:Date.now()}}
  };
  const [transit,transitSchedule]=await Promise.all([
    retrieve(mbtaFoxboroAlertsUrl,summarizeMbtaFoxboroAlerts),
    retrieve(mbtaFoxboroSchedulesUrl(game),summarizeMbtaFoxboroSchedules)
  ]);
  return {transit,transitSchedule};
}
async function checkVenue(venue){
  const result={at:Date.now(),alerts:null,alertsError:null,quakes,quakesError,observation:null};
  if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)){result.alertsError='Venue point unavailable';return result}
  const observation=fetchNwsStationObservation(venue,{headers});
  try{
    const url=`https://api.weather.gov/alerts/active?point=${venue.lat},${venue.lon}`;
    const alerts=await fetchJson(url);
    if(alerts?.type!=='FeatureCollection'||!Array.isArray(alerts.features)||alerts.features.length>100)throw Error('Invalid NWS alert collection');
    result.alerts=alerts;
  }catch(error){result.alertsError=`NWS ${String(error.message).slice(0,100)}`}
  result.observation=await observation;
  result.at=Date.now();
  return result;
}
async function forecastFor(game){
  const venue=game.venue,active=game.status==='in progress in source',target=active?Date.now():Date.parse(game.kickoff);
  if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||game.status==='completed in source'||!active&&target<Date.now())return null;
  try{
    const point=await fetchJson(`https://api.weather.gov/points/${venue.lat},${venue.lon}`);
    const url=point?.properties?.forecastHourly;
    if(!nwsHost.test(url||''))throw Error('Unexpected NWS forecast URL');
    const hourly=await fetchJson(url),periods=hourly?.properties?.periods;
    if(!Array.isArray(periods)||periods.length>300)throw Error('Invalid NWS hourly forecast');
    const period=periods.find(item=>Date.parse(item.startTime)<=target&&target<Date.parse(item.endTime));
    if(!period)throw Error('Event hour outside returned hourly periods');
    return {state:'ok',checkedAt:Date.now(),kickoff:game.kickoff,sourceUrl:url,period};
  }catch{return {state:'failed',kickoff:game.kickoff}}
}
const outDir=path.join(site,'reports');
await fs.mkdir(outDir,{recursive:true});
async function previousReportState(id){
  const name=`${id}.state.json`;
  try{return JSON.parse(await fs.readFile(path.join(outDir,name),'utf8'))}catch{}
  try{
    const url=`https://redxking.github.io/event-atlas-nfl-demo/reports/${name}?check=${now}`;
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(!response.ok)return null;
    const raw=await response.text();
    return raw.length<=150000?JSON.parse(raw):null;
  }catch{return null}
}
const entries=[],changeStates=[];
for(const game of games){
  if(!/^nfl:\d+$/.test(game.id))throw Error('Unexpected NFL game ID');
  const id=game.id.replace(':','-');
  const monitoringMode=publishedNflReportMode(game,now);
  if(monitoringMode==='near_term_monitoring'&&!venueChecks.has(game.venue.id))venueChecks.set(game.venue.id,await checkVenue(game.venue));
  const conditions=monitoringMode==='near_term_monitoring'?venueChecks.get(game.venue.id):null;
  const [forecast,mbta,directGame]=monitoringMode==='near_term_monitoring'
    ?await Promise.all([forecastFor(game),publishedMbta(game),fetchSelectedGame(game)])
    :[null,{transit:null,transitSchedule:null},null];
  const bundle=buildNflEvidenceBundle(game,{...inputs,monitoringMode,conditions,forecast,directGame,police:monitoringMode==='near_term_monitoring'?publishedPolice(game):null,...mbta});
  bundle.reportMonitoringMode=monitoringMode;
  let changeState=null;
  if(monitoringMode==='near_term_monitoring'){
    changeState=buildPublishedReportState(bundle,game,inputs.news,await previousReportState(id),Date.parse(bundle.generatedAt));
    changeStates.push(changeState);
    bundle.publishedChanges={comparison:changeState.comparison,newChangeCount:changeState.newChangeCount,items:changeState.changes};
  }
  const body=buildNflPublicReport(bundle);
  const frontmatter=`---\ntitle: ${JSON.stringify(`NFL public-source review: ${game.title}`)}\nauthor: Angelis Pseftis\ncreator: Angelis Pseftis\nstatus: Automated public-source compilation; unreviewed\ngenerated_at: ${bundle.generatedAt}\n---\n\n`;
  const filename=`${id}.md`;
  await fs.writeFile(path.join(outDir,filename),frontmatter+body,'utf8');
  const htmlName=`${id}.html`;
  await fs.writeFile(path.join(outDir,htmlName),renderPublicReportHtml(body,{title:`NFL public-source review: ${game.title}`,generatedAt:bundle.generatedAt,markdownPath:filename}),'utf8');
  if(changeState)await fs.writeFile(path.join(outDir,`${id}.state.json`),JSON.stringify(changeState)+'\n','utf8');
  entries.push({eventId:game.id,title:game.title,kickoff:game.kickoff,venueName:game.venue.name,path:`reports/${htmlName}`,markdownPath:`reports/${filename}`,generatedAt:bundle.generatedAt,monitoringMode,nwsAlerts:conditions?conditions.alertsError?'unavailable':'checked':'not checked outside near-term window',nwsObservation:monitoringMode==='near_term_monitoring'?bundle.picture.observationContext?.state||'unavailable or stale':'not checked outside near-term window',nwsForecast:monitoringMode==='near_term_monitoring'?bundle.picture.forecastContext.state:'not checked outside near-term window',directGame:directGame?.state||'not checked outside near-term window',mbtaAlerts:mbta.transit?.state||'outside source area',mbtaSchedule:mbta.transitSchedule?.state||'outside source area',newPublishedChanges:changeState?.newChangeCount??null});
}
const index={status:'ok',builtAt:new Date().toISOString(),basis:'Hourly public-source compilations for every upcoming U.S. NFL game. Games within seven days, active games, and source-completed games within 24 hours of listed kickoff receive point alert, nearby station observation, event-hour forecast, and exact-game publisher checks. More distant games are planning snapshots without those live event checks. Each report is unreviewed; direct browser checks may be newer. A station reading is not a stadium measurement or a kickoff forecast. Source failures and missing operational data are shown as gaps.',reports:entries};
await fs.writeFile(path.join(outDir,'index.json'),JSON.stringify(index)+'\n','utf8');
const changeFeed=buildPublishedChangeFeed(entries,changeStates,Date.now());
await fs.writeFile(path.join(outDir,'changes.json'),JSON.stringify(changeFeed)+'\n','utf8');
await fs.writeFile(path.join(outDir,'changes.xml'),renderPublishedChangeAtom(changeFeed),'utf8');
console.log(`Published NFL reports: ${entries.length}; NWS alert checks ${[...venueChecks.values()].filter(item=>!item.alertsError).length}/${venueChecks.size}`);
