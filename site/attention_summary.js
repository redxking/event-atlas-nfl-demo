// Display only event-relevant source concerns. Coverage recovery belongs in source details.
export function attentionSummary(picture) {
  const items=(picture?.reviewQueue?.items||[]).filter(item=>item.status==='unreviewed_source_cue'&&item.sourceUrl);
  const pending=!Array.isArray(picture?.reviewQueue?.items)||picture.reviewQueue.state==='not_started';
  const urgent=items.filter(item=>item.domain==='weather alert');
  return {items,urgent,screeningState:pending?'pending':'available',sources:picture?.sources||[],label:pending?'Monitoring not started':urgent.length?`${urgent.length} urgent weather concern${urgent.length===1?'':'s'}`:items.length?`${items.length} potential concern${items.length===1?'':'s'}`:'No flagged concerns',tone:urgent.length?'urgent':items.length?'review':'quiet'};
}
export function humanLabel(value) {
  // Sounder route labels verified in Sound Transit's https://www.soundtransit.org/GTFS-rail/40_gtfs.zip routes.txt (2026-10-10).
  const labels={SNDR_EV:'Sounder N Line',SNDR_TL:'Sounder S Line',OTHER_EFFECT:'Other service effect — review notice',ADDITIONAL_SERVICE:'Additional service',route_change_notice_listed:'Route change notice published',current_snapshot:'Current source snapshot',not_started:'Monitoring has not started',stale_or_unavailable:'Source is old or unavailable',no_coverage:'No connected source coverage',no_public_image:'No public image available',not_screenable:'Cannot assess this source for the event',ok:'Source retrieved',failed:'Source check failed',error:'Source check failed',partial:'Some source data is available',pre_event:'Before the event',during_event:'During the event',post_event:'After the event',EXACT_GAME_ID:'Matches this scheduled game',EXACT_GAME_ARTICLE:'Article about this game',not_assessed:'Not yet assessed',reported_unreviewed:'Reported; awaiting review',direct_event_record:'About this game',time_place_candidate:'Time and location may overlap',regional_context:'Regional context',contradictory_record:'Conflicting information',excluded_link:'Not relevant to this game',unreviewed_source_cue:'Needs assessment',source_check_needed:'Source check needed',not_reviewed:'Awaiting review',updated_evidence:'New information received',NO_SERVICE:'Service suspended',SIGNIFICANT_DELAYS:'Significant delays'};
  return labels[value]||String(value??'').replace(/_/g,' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
}

export function humanText(value){
 return String(value??'').split(/(https?:\/\/\S+)/g).map(part=>part.startsWith('http://')||part.startsWith('https://')?part:part.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g,humanLabel)).join('').replace(/\b(?:stale_or_unavailable|no_coverage|not_started|current_snapshot|not_assessed|reported_unreviewed|source_check_needed|updated_evidence|not_reviewed|pre_event|during_event|post_event)\b/g,humanLabel).replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g,value=>new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:'America/New_York'})).replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,humanLabel);
}
