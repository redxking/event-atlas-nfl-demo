import {selectChargersTheme} from './chargers_themes.js';
import {selectMetroSofiPlan} from './metro_sofi_plan.js';
import {selectMetroI105Notice} from './metro_i105_notice.js';
import {selectSofiEventPage} from './sofi_event_pages.js';
import {selectInglewoodAlerts} from './inglewood_alerts.js';

export function selectSofiContext(game,inputs={},now=Date.now()){
  return {
    chargersTheme:selectChargersTheme(game,inputs.chargersThemes,now),
    metroSofiPlan:selectMetroSofiPlan(game,inputs.metroSofiPlan,now),
    metroI105Notice:selectMetroI105Notice(game,inputs.metroI105Notice,now),
    sofiVenueEvent:selectSofiEventPage(game,inputs.sofiEventPages,now),
    inglewoodAlerts:selectInglewoodAlerts(game,inputs.inglewoodAlerts,now)
  };
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hosts=new Set(['www.chargers.com','www.metro.net','cloud.sfmc.metro.net','www.sofistadium.com','www.cityofinglewood.org']);
function link(value,label='Official source'){
  try{const url=new URL(value);if(url.protocol==='https:'&&hosts.has(url.hostname)&&!url.username&&!url.password)return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`}catch{}
  return '';
}
const outside=item=>!item||item.state?.startsWith('outside_source');
const local=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('en-US',{timeZone:'America/Los_Angeles',timeZoneName:'short'}):'unavailable'};

export function renderSofiContext(context){
  if(Object.values(context).every(outside))return '';
  const rows=[];
  function row(title,item,body){
    if(outside(item))return;
    const unavailable=['unavailable','kickoff_unverified','no_exact_match'].includes(item.state);
    const status={unavailable:'Source unavailable or stale',kickoff_unverified:'Kickoff requires verification',no_exact_match:'No exact game match'}[item.state];
    rows.push(`<section><h4>${escape(title)}</h4>${unavailable?`<p>${status}</p>`:body}<p>${link(item.sourceUrl)}${item.checkedAt||item.asOf?` · Checked ${escape(item.checkedAt||item.asOf)}`:''}</p></section>`);
  }
  const venue=context.sofiVenueEvent;
  row('Venue event plan',venue,`<p>Published local times: event ${escape(venue?.eventStartsLocal)}; parking ${escape(venue?.parkingLotsOpenLocal)}; doors ${escape(venue?.doorsOpenLocal)}.</p>${venue?.detailKickoffConflictsWithSidebar?`<p>Source conflict: detail text lists ${escape(venue.detailKickoffLocal)} while the event sidebar lists ${escape(venue.eventStartsLocal)}. Confirm with the venue.</p>`:''}`);
  const transit=context.metroSofiPlan;
  row('Metro stadium service plan',transit,`<p>Board at ${escape(transit?.boarding)}. Illustrative outbound start: ${escape(local(transit?.illustrativeOutboundStart))}; published interval ${escape(transit?.outboundMaximumMinutesBetweenBuses)} minutes or less. Return starts at ${escape(transit?.returnStarts)}, continuing ${escape(transit?.returnMinutesAfterGame)} minutes after game end.</p>`);
  const work=context.metroI105Notice;
  row('Metro I-105 anticipated work',work,`<p>${escape(work?.route)}: ${escape(work?.lanes)}. Planned ${escape(local(work?.closureStart))} through ${escape(local(work?.closureEnd))}.</p><p>${work?.state==='pregame_window_overlap'?`${escape(work.overlapMinutes)} minutes overlap the illustrative pregame review window.`:'No overlap with the illustrative review window.'} Planned work ends ${escape(work?.endsBeforeKickoffMinutes)} minutes before kickoff. ${escape(work?.operationState)}.</p>`);
  const theme=context.chargersTheme;
  row('Chargers published game theme',theme,`<p>${escape(theme?.theme)}${theme?.presentingPartner?` · ${escape(theme.presentingPartner)}`:''}. Published ${escape(theme?.publishedAt)}.</p>`);
  const city=context.inglewoodAlerts;
  row('Inglewood city listings',city,Object.entries(city?.categories||{}).map(([name,item])=>`<p>${escape(name)}: ${item.state==='retrieved_listing'?`${escape(item.listedCount)} listed notices`:'source unavailable'}.</p>${name==='traffic'?(item.entries||[]).map(entry=>`<p>${link(entry.sourceUrl,entry.title)}${entry.sameLocalDate?' · Date in title matches game date; relevance requires review.':''}</p>`).join(''):''}`).join(''));
  return `<details class="brief-details sofi-context"><summary>SoFi venue, transit and city notices</summary>${rows.join('')}<p>Published plans and city listings require operator confirmation. A time or date match does not establish venue impact, attendance or a threat.</p></details>`;
}
