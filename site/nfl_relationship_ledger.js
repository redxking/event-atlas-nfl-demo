const HOUR=3600000;
const validTime=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Date(at).toISOString():null};
const validUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}};
const digest=value=>{let hash=2166136261;for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return (hash>>>0).toString(16).padStart(8,'0')};
const id=(kind,key)=>`rel:${kind}:${digest(key)}`;
const cuePathway=type=>({
  'weather alert':['venue weather exposure','NWS_POINT_ALERT_WINDOW'],
  'convective outlook':['venue weather exposure','SPC_POLYGON_KICKOFF'],
  'excessive rainfall outlook':['venue weather exposure','WPC_POLYGON_KICKOFF'],
  'road condition':['possible access route; dependency unverified','ROAD_RADIUS_WINDOW'],
  'regional road advisory':['regional travel corridor; event route unverified','REGIONAL_NOTICE_DATE_TEXT'],
  'access plan overlap':['club access plan and nearby road; route effect unverified','CLUB_PLAN_ROAD_WINDOW'],
  'transit alert':['possible transit service; event dependency unverified','OPERATOR_ALERT_WINDOW'],
  'concurrent city event':['regional crowd or route context; interaction unverified','CITY_EVENT_WINDOW']
})[type]||['event relationship unverified','BOUNDED_SOURCE_CUE'];

export function buildNflRelationshipLedger(game,picture,{news=null,roads=null}={}){
  if(typeof game?.id!=='string'||!game.id.startsWith('nfl:')||!game.venue?.id||!picture||picture.eventId!==game.id)throw Error('Matching NFL game and event picture required');
  const kickoff=validTime(game.kickoff),windowStart=kickoff?new Date(Date.parse(kickoff)-4*HOUR).toISOString():null,windowEnd=kickoff?new Date(Date.parse(kickoff)+5*HOUR).toISOString():null;
  const sourceUrl=validUrl(game.sourceUrl);
  const items=[{
    id:id('direct_event_record',game.id+'|schedule'),relationship:'direct_event_record',recordId:game.id,claim:`ESPN lists ${game.title} at ${game.venue.name} for ${kickoff||'an unverified kickoff'}.`,basis:'Exact ESPN game ID in the published schedule snapshot.',ruleId:'EXACT_GAME_ID',eventElement:'scheduled game and source venue',pathway:'event identity',sourceUrl,sourceTime:validTime(game.sourceRetrievedAt),validityStart:null,validityEnd:null,distanceKm:null,disposition:'reported_unreviewed',possibleImpact:'not_assessed',alternative:'The schedule or venue may be revised; confirm with the NFL or host club.',duplicateCueCount:1
  }];
  const article=picture.gameArticle;
  if(article?.state==='current_snapshot'&&article.article?.headline&&validUrl(article.article.url))items.push({
    id:id('direct_event_record',game.id+'|'+article.article.url),relationship:'direct_event_record',recordId:`espn-article:${game.id}`,claim:article.article.headline,basis:'Publisher article metadata was returned for this exact ESPN game ID; article content has not been reviewed.',ruleId:'EXACT_GAME_ARTICLE',eventElement:'selected game',pathway:'event-specific publisher coverage',sourceUrl:validUrl(article.article.url),sourceTime:validTime(article.article.publishedAt),validityStart:null,validityEnd:null,distanceKm:null,disposition:'reported_unreviewed',possibleImpact:'not_assessed',alternative:'Headline metadata does not verify a venue condition, attendance or threat.',duplicateCueCount:1
  });
  const groups=new Map();
  for(const cue of picture.cues||[]){
    const url=validUrl(cue.sourceUrl),key=`${cue.type}|${cue.sourceId||url||cue.title}`;
    if(!groups.has(key))groups.set(key,{cue,count:0});
    groups.get(key).count++;
  }
  for(const [key,{cue,count}] of [...groups].slice(0,24)){
    const [pathway,rule]=cuePathway(cue.type);
    const road=Array.isArray(roads)?roads.find(item=>item.id===cue.sourceId):null;
    const regional=['regional road advisory','concurrent city event'].includes(cue.type),relationship=regional?'regional_context':'time_place_candidate';
    items.push({id:id(relationship,key),relationship,recordId:cue.sourceId||null,claim:cue.title,basis:cue.basis,ruleId:rule,eventElement:regional?'regional event area':game.venue.name,pathway,sourceUrl:validUrl(cue.sourceUrl),relatedSourceUrl:validUrl(cue.relatedSourceUrl),sourceTime:validTime(cue.sourceAt),validityStart:validTime(road?.startAt),validityEnd:validTime(road?.endAt),distanceKm:Number.isFinite(road?.distanceKm)?road.distanceKm:null,disposition:regional?'discovery_only':'review_candidate',possibleImpact:'not_assessed',alternative:'Time or proximity may overlap without an event effect; verify the actual route, service or exposure.',duplicateCueCount:count});
  }
  const discovery=news?.state==='current_snapshot'&&Array.isArray(news.teamDiscovery)?news.teamDiscovery.find(item=>validUrl(item.url)&&item.url!==article?.article?.url):null;
  if(discovery)items.push({id:id('regional_context',discovery.url),relationship:'regional_context',recordId:null,claim:discovery.title,basis:`${discovery.publisher||'Publisher'} headline matched team wording (${discovery.matchBasis}); the exact game was not identified by this rule.`,ruleId:'TEAM_NAME_DISCOVERY',eventElement:'team organizations',pathway:'possible team news; event relationship unverified',sourceUrl:validUrl(discovery.url),sourceTime:validTime(discovery.publishedAt),validityStart:null,validityEnd:null,distanceKm:null,disposition:'discovery_only',possibleImpact:'not_assessed',alternative:'The article may concern another game or a general team topic.',duplicateCueCount:1});
  const outside=Array.isArray(roads)&&windowStart&&windowEnd?roads.find(item=>{
    const start=Date.parse(item.startAt),end=Date.parse(item.endAt);
    return item.id&&validUrl(item.sourceUrl)&&Number.isFinite(start)&&Number.isFinite(end)&&end>=start&&Number.isFinite(item.distanceKm)&&item.distanceKm<=10&&(end<Date.parse(windowStart)||start>Date.parse(windowEnd));
  }):null;
  if(outside)items.push({id:id('excluded_link',outside.id),relationship:'excluded_link',recordId:outside.id,claim:`${outside.kind||'Road record'} · ${outside.name||'unnamed road'}`,basis:`Publisher window ${outside.startAt} to ${outside.endAt} does not overlap the illustrative event window ${windowStart} to ${windowEnd}; ${outside.distanceKm} km from the unreviewed venue point.`,ruleId:'ROAD_WINDOW_DISJOINT',eventElement:'candidate venue area',pathway:'no current event-window road link established',sourceUrl:validUrl(outside.sourceUrl),sourceTime:validTime(outside.sourceRecordDate),validityStart:validTime(outside.startAt),validityEnd:validTime(outside.endAt),distanceKm:outside.distanceKm,disposition:'excluded_from_active_cues',possibleImpact:'not_assessed',alternative:'A changed schedule or publisher road window requires rescreening.',duplicateCueCount:1});
  if(picture.directGame?.state==='checked'&&picture.directGame.scheduleDiffers)items.push({id:id('contradictory_record',game.id+'|direct-schedule'),relationship:'contradictory_record',recordId:game.id,claim:'Direct game-summary kickoff differs from the published schedule snapshot.',basis:'Same ESPN game ID returned a different date in the selected-game check.',ruleId:'EXACT_GAME_SCHEDULE_CONFLICT',eventElement:'kickoff and all time-screened links',pathway:'schedule correction review',sourceUrl:validUrl(picture.directGame.sourceUrl),sourceTime:validTime(picture.directGame.checkedAt),validityStart:null,validityEnd:null,distanceKm:null,disposition:'disputed_pending_review',possibleImpact:'not_assessed',alternative:'The direct check may have incomplete or ambiguous date semantics; confirm with the NFL or host club.',duplicateCueCount:1});
  const timeBases={EXACT_GAME_ID:'system schedule retrieval',EXACT_GAME_ARTICLE:'publisher publication',NWS_POINT_ALERT_WINDOW:'alert effective time',SPC_POLYGON_KICKOFF:'forecast issuance',WPC_POLYGON_KICKOFF:'forecast issuance',ROAD_RADIUS_WINDOW:'publisher record date or validity start',REGIONAL_NOTICE_DATE_TEXT:'publisher update',CLUB_PLAN_ROAD_WINDOW:'road publisher record date or validity start',OPERATOR_ALERT_WINDOW:'operator update or retrieval',CITY_EVENT_WINDOW:'city publication or retrieval',TEAM_NAME_DISCOVERY:'publisher publication',ROAD_WINDOW_DISJOINT:'publisher record date',EXACT_GAME_SCHEDULE_CONFLICT:'system direct-check acquisition'};
  for(const item of items){item.sourceTimeBasis=timeBases[item.ruleId]||'cue time basis unverified';item.sourceIndependence=item.duplicateCueCount>1?'same_source_key_not_independent':'not_assessed'}
  const counts=Object.fromEntries(['direct_event_record','time_place_candidate','regional_context','contradictory_record','excluded_link'].map(type=>[type,items.filter(item=>item.relationship===type).length]));
  return {schema:'event-atlas.nfl-relationship-ledger.v1',eventId:game.id,eventRevision:{kickoff,sourceRetrievedAt:validTime(game.sourceRetrievedAt),venueId:String(game.venue.id)},screeningWindow:{startAt:windowStart,endAt:windowEnd,basis:'Four hours before to five hours after listed kickoff; illustrative, not an approved operating window.'},counts,candidateCueTotal:(picture.cues||[]).length,coverageGapCount:picture.gaps?.length||0,items,limitations:'Automated source-link classification for analyst review. Distinct records are not independent corroboration by default. No relationship here establishes stadium impact, named-person attendance, threat severity, confidence, or authorized action.'};
}
