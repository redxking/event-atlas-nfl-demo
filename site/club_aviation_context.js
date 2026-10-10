const HOUR=3600000;
const current=(at,now)=>{const value=Date.parse(at);return Number.isFinite(value)&&value<=now+60000&&now-value<=12*HOUR};

export function compareClubAviation(game,release,airspace,tfr,now=Date.now()){
  const club=release?.claims?.find(item=>item.id==='flyover');
  if(game?.id!=='nfl:401872990'||game?.venue?.id!=='3798'||!club||release.state!=='current_published_announcements')return {state:'no_current_exact_game_club_plan',summary:'No current club-published flyover plan passed the exact-game source check.',clubSourceUrl:null,faaSourceUrl:null,tfrSourceUrl:null};
  const faa=airspace?.byGame?.[game.id],faaCurrent=current(airspace?.builtAt,now);
  const matched=faaCurrent&&faa?.eventName==='Chicago Bears @ Green Bay Packers'&&faa?.venueName==='Lambeau Field'&&['SCHEDULED','ACTIVE'].includes(faa.status)&&Number.isFinite(Date.parse(faa.startAt))&&Number.isFinite(Date.parse(faa.endAt))&&Date.parse(faa.startAt)<Date.parse(faa.endAt)&&/^https:\/\/faasysops\.maps\.arcgis\.com\/home\/item\.html\?id=/.test(airspace.sourceItemUrl||'');
  const tfrCurrent=current(tfr?.builtAt,now);
  return {state:matched?'club_plan_and_faa_event_record':'club_plan_faa_status_unverified',summary:matched?'The Packers announce a flyover and FAA SEAMS lists a scheduled event airspace window for this game. The club article gives no flight time. These two records do not confirm an aircraft flight, current NOTAM terms, authorization, or a drone detection.':'The Packers announce a flyover; a current, identity-matched FAA SEAMS event record is unavailable. Confirm the current NOTAM and club plan directly.',clubSourceUrl:club.sourceUrl,faaSourceUrl:matched?airspace.sourceItemUrl:null,tfrSourceUrl:tfr?.sourcePageUrl||'https://tfr.faa.gov/tfr3/',faaRecord:matched?{status:faa.status,startAt:faa.startAt,endAt:faa.endAt,sourceUpdatedAt:faa.sourceUpdatedAt}:null,tfrListState:tfrCurrent?'current bounded list checked':'stale or unavailable',tfrSpatialCandidates:tfrCurrent?Math.min(100,tfr.byVenue?.[game.venue.id]?.length||0):null,checkedAt:release.asOf};
}
