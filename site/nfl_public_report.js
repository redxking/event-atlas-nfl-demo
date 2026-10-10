const clean=value=>String(value??'').replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim().replace(/[\\`*_{}\[\]<>|]/g,'\\$&');
const iso=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():'not supplied'};
const source=(url,label='Source')=>{try{const parsed=new URL(url);return parsed.protocol==='https:'?`[${clean(label)}](${parsed.href.replace(/[()]/g,encodeURIComponent)})`:'Source link unavailable'}catch{return 'Source link unavailable'}};
const line=(label,value)=>`- **${label}:** ${clean(value)||'not supplied'}`;
const section=(title,rows,empty)=>[`## ${title}`,rows.length?rows.join('\n'):empty,''].join('\n');

export function buildNflPublicReport(bundle){
  if(bundle?.schema!=='event-atlas.public-evidence-bundle.v1'||!bundle.event||!bundle.venue||!bundle.picture)throw Error('Current NFL public evidence bundle required');
  const {event,venue,picture,publicObservations:observations={},sourceSnapshots={}}=bundle;
  const rows=[
    `# NFL event public-source review: ${clean(event.title)}`,
    '',
    'Automated public-source compilation. Unreviewed; severity and confidence have not been assessed. This is not an operational threat determination or dissemination approval.',
    '',
    line('Generated',iso(bundle.generatedAt)),
    line('Event',`${event.title} · week ${event.week??'unknown'} · ${event.status||'status unknown'}`),
    line('Kickoff',event.timeTbd?'Time to be determined':iso(event.kickoff)),
    line('Venue',`${venue.name}, ${venue.address}`),
    line('Map point',Number.isFinite(venue.lat)&&Number.isFinite(venue.lon)?`${venue.lat}, ${venue.lon} (unreviewed candidate)`:'unavailable'),
    `- **Schedule source:** ${source(event.sourceUrl,'Publisher event record')}`,
    '',
    '## Review summary',
    line('Assessment','Severity not assessed; confidence not assessed'),
    line('NWS alert review candidates',picture.cueCounts?.weather??0),
    line('SPC forecast review candidates',picture.cueCounts?.outlook??0),
    line('WPC rainfall forecast review candidates',picture.cueCounts?.rainfall??0),
    line('Roadway time overlaps',picture.cueCounts?.road??0),
    line('Transit alert time overlaps',picture.cueCounts?.transit??0),
    'These counts are bounded source review cues. They do not establish event impact, a person at risk, or a threat.',
    ''
  ];
  const forecast=observations.kickoffForecast;
  if(forecast?.state==='current forecast')rows.push('## Kickoff forecast',line('NWS hourly forecast',`${forecast.period?.shortForecast||'description unavailable'} · ${forecast.period?.temperature??'temperature unavailable'}°${forecast.period?.temperatureUnit||''} · wind ${forecast.period?.windSpeed||'unavailable'} ${forecast.period?.windDirection||''} · precipitation ${forecast.period?.precipitationPercent??'unavailable'}%`),line('Checked',iso(forecast.checkedAt)),`- **Source:** ${source(forecast.sourceUrl,'NWS hourly forecast')}`,'Forecast, not an observed condition.','');
  const outlook=observations.convectiveOutlook;
  rows.push('## NOAA SPC Day 1–3 outlook',line('State',outlook?.state||'unavailable'),...(outlook?.match?[line('Published category',`${outlook.match.category} on Day ${outlook.match.day}`),line('Issued',iso(outlook.match.issuedAt)),line('Valid',`${iso(outlook.match.validAt)} to ${iso(outlook.match.expiresAt)}`)]:[]),`- **Source:** ${source(outlook?.sourceUrl,'NOAA SPC categorical outlook')}`,'Regional forecast context at the candidate point and listed kickoff; not a warning, observed condition, venue impact, or threat finding.','');
  const rain=observations.excessiveRainOutlook;
  rows.push('## NOAA WPC excessive-rainfall outlook',line('State',rain?.state||'unavailable'),...(rain?.match?[line('Published category',`${rain.match.category} on Day ${rain.match.day}`),line('Issued',iso(rain.match.issuedAt)),line('Valid',`${iso(rain.match.validAt)} to ${iso(rain.match.expiresAt)}`)]:[]),`- **Source:** ${source(rain?.sourceUrl,'NOAA WPC rainfall outlook')}`,'Regional flash-flood planning context at the candidate point and listed kickoff; not a flood warning, observed condition, route or venue impact, or threat finding.','');
  rows.push(section('Time-screened review cues',(picture.cues||[]).map(item=>`- **${clean(item.type)} — ${clean(item.title)}:** ${clean(item.basis)}. Source time: ${iso(item.sourceAt)}. ${source(item.sourceUrl)}`),'No time-screened cue is present in the current bounded sample; this is not an all-clear.'));
  rows.push(section('Public source status',(picture.sources||[]).map(item=>`- **${clean(item.name)}:** ${clean(item.state)}; as of ${iso(item.asOf)}. ${clean(item.detail)} ${source(item.sourceUrl)}`),'Source status unavailable.'));
  rows.push(section('Publisher NFL headlines',(observations.nflHeadlines?.articles||[]).map(item=>`- **${clean(item.title)}:** ${clean(item.publisher)}; published ${iso(item.publishedAt)}; match basis ${clean(item.matchBasis)}. ${source(item.url,'Article')}`),'No current team-name headline match in the connected snapshot. This does not establish an absence of relevant reporting.'));
  rows.push('Headlines are discovery context. A team-name match does not verify game relevance, VIP attendance, venue impact, or a threat.','');
  rows.push(section('Nearby agency road records',(observations.roads||[]).map(item=>`- **${clean(item.kind)} — ${clean(item.name)}:** ${clean(item.agency)}; ${clean(item.distanceKm)} km from candidate point; ${clean(item.detail)}. Published window: ${iso(item.startAt)} to ${iso(item.endAt)}. ${source(item.sourceUrl)}`),'No connected nearby road record is available in this snapshot.'));
  rows.push('Proximity and publisher-listed windows do not establish a route or event impact. Up to 50 records per venue are retained.','');
  rows.push(section('Roadway camera metadata',(observations.cameras||[]).map(item=>`- **${clean(item.name)}:** ${clean(item.agency)}; ${clean(item.distanceKm)} km from candidate point; status ${clean(item.operationalStatus||item.inService||'not supplied')}. ${source(item.viewerUrl||item.sourceUrl,'Agency camera or metadata')}`),'No connected roadway camera metadata for this venue.'));
  rows.push('A roadway camera listing does not verify a stadium view, live image, or access to stadium CCTV.','');
  rows.push(section('NWS alert observations',(observations.weather||[]).map(item=>`- **${clean(item.event)}:** ${clean(item.severity)} severity; ${clean(item.urgency)} urgency; effective ${iso(item.effective)} to ${iso(item.ends)}. ${source(item.sourceUrl,'NWS alert')}`),'No NWS alert record in the current point response, or the feed is unavailable; check source status above.'));
  rows.push(section('USGS regional earthquakes',(observations.earthquakes||[]).map(item=>`- **${clean(item.title)}:** magnitude ${clean(item.magnitude)}; occurred ${iso(item.occurredAt)}. ${source(item.sourceUrl,'USGS event')}`),'No nearby magnitude 2.5+ record in the bounded weekly sample, or the feed is unavailable.'));
  const airspace=bundle.geography?.airspace;
  rows.push(section('FAA airspace and TFR review',[
    ...(airspace?[`- **SEAMS event airspace:** ${clean(airspace.record?.status||'status unavailable')}; published window ${iso(airspace.record?.startAt)} to ${iso(airspace.record?.endAt)}. ${source(airspace.sourceUrl,'FAA SEAMS source')}`]:[]),
    ...(bundle.geography?.tfrCandidates||[]).slice(0,8).map(item=>`- **FAA TFR spatial candidate:** ${clean(item.notamNumber||item.notam||item.id||'identifier unavailable')}; source window ${iso(item.startAt)} to ${iso(item.endAt)}. ${source(item.sourceUrl||item.url,'FAA notice')}`)
  ],'No linked FAA airspace record or TFR spatial candidate in this snapshot. Confirm the current NOTAM directly.'));
  rows.push('Published airspace and TFR geometry do not detect drones or establish a ground security perimeter.','');
  const police=observations.policeAggregate;
  if(police)rows.push('## Delayed public safety context',line('Nearby public records',police.nearby??'unavailable'),line('Source window count',police.windowCount??'unavailable'),line('Radius',police.radiusKm==null?'unavailable':`${police.radiusKm} km`),'These are delayed public records or counts, not active police alerts or stadium incidents.','');
  const openRoad=observations.openRoadwayAggregate;
  if(openRoad)rows.push('## Open roadway activity',line('Nearby publisher-listed entries',openRoad.nearby??'unavailable'),line('Checked',iso(openRoad.checkedAt)),`- **Source:** ${source(openRoad.sourceUrl,'Publisher feed')}`,'Approximate source points do not establish access or event impact.','');
  const transit=observations.stationAlerts,septa=observations.septaBLineAlerts;
  rows.push(section('Transit alert review',[
    ...(transit?.alerts||[]).slice(0,8).map(item=>`- **${clean(item.header)}:** ${clean(item.effect)}; event-window overlap ${item.eventWindowOverlap?'yes':'not established'}. ${source(item.sourceUrl,'Transit agency alert')}`),
    ...(septa?.alerts||[]).slice(0,8).map(item=>`- **${clean(item.header)}:** ${clean(item.effect)}; event-window overlap ${item.eventWindowOverlap?'yes':'not established'}. ${source(item.sourceUrl,'SEPTA alert')}`)
  ],'No connected station or route alert record for this event, or the relevant snapshot is unavailable. Check source status above.'));
  rows.push('Transit alert overlap is a review cue, not verified game travel impact.','');
  const advisory=observations.nationalAdvisory;
  rows.push(section('DHS national advisory context',(advisory?.active||[]).map(item=>`- **${clean(item.type)}:** ${clean(item.summary)}; ${iso(item.start)} to ${iso(item.end)}. ${source(item.url,'DHS advisory')}`),`${clean(advisory?.state||'unavailable')}; no venue-specific conclusion follows. ${source(advisory?.sourceUrl,'DHS feed')}`));
  rows.push(section('Coverage and verification gaps',(picture.gaps||[]).map(item=>`- ${clean(item)}`),'Coverage gaps unavailable.'));
  rows.push('## Provenance and limits',line('Schedule snapshot',iso(sourceSnapshots.schedule)),line('Road snapshot',iso(sourceSnapshots.roads)),line('Camera snapshot',iso(sourceSnapshots.cameras)),line('SPC snapshot',iso(sourceSnapshots.spc)),line('WPC rainfall snapshot',iso(sourceSnapshots.wpcRain)),line('FAA airspace snapshot',iso(sourceSnapshots.airspace)),line('FAA TFR snapshot',iso(sourceSnapshots.tfr)),line('NFL news snapshot',iso(sourceSnapshots.news)),line('VIP attendance','Not verified; named-person records are not collected in the public demo'),'',clean(bundle.useLimit),'');
  return rows.join('\n')+'\n';
}
