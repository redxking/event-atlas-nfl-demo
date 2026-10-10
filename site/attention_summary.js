// Display only event-relevant source concerns. Coverage recovery belongs in source details.
export function attentionSummary(picture) {
  const items=(picture?.reviewQueue?.items||[]).filter(item=>item.status==='unreviewed_source_cue'&&item.sourceUrl);
  const urgent=items.filter(item=>item.domain==='weather alert');
  return {items,urgent,sources:picture?.sources||[],label:picture?.reviewQueue?.state==='not_started'?'Monitoring not started':urgent.length?`${urgent.length} urgent weather concern${urgent.length===1?'':'s'}`:items.length?`${items.length} potential concern${items.length===1?'':'s'}`:'No flagged concerns',tone:urgent.length?'urgent':items.length?'review':'quiet'};
}
export function humanLabel(value) {
  const labels={EXACT_GAME_ID:'Matches this scheduled game',EXACT_GAME_ARTICLE:'Article about this game',not_assessed:'Not yet assessed',reported_unreviewed:'Reported; awaiting review',direct_event_record:'About this game',time_place_candidate:'Time and location may overlap',regional_context:'Regional context',contradictory_record:'Conflicting information',excluded_link:'Not relevant to this game',unreviewed_source_cue:'Needs assessment',source_check_needed:'Source check needed',not_reviewed:'Awaiting review',updated_evidence:'New information received',NO_SERVICE:'Service suspended',SIGNIFICANT_DELAYS:'Significant delays'};
  return labels[value]||String(value??'').replace(/_/g,' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
}

export function humanText(value){
 return String(value??'').replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g,value=>new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone:'America/New_York'})).replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,humanLabel);
}
