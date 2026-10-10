const expected={
  'nfl:401872989':{slug:'chargers-broncos-2026',home:'Los Angeles Chargers',away:'Denver Broncos',kickoff:'2026-10-11T20:05',date:'Oct. 11, 2026',start:'1:05 PM'},
  'nfl:401872994':{slug:'rams-bills-2026',home:'Los Angeles Rams',away:'Buffalo Bills',kickoff:'2026-10-13T00:15',date:'Oct. 12, 2026',start:'5:15 PM'}
};
const time=value=>value==='TBD'||/^(?:1[0-2]|[1-9]):[0-5]\d [AP]M$/.test(value||'');

export function selectSofiEventPage(game,snapshot,now=Date.now()){
  const spec=expected[game?.id];
  if(!spec||game?.venue?.id!=='7065'||game?.teams?.find(team=>team.role==='home')?.name!==spec.home||game?.teams?.find(team=>team.role==='away')?.name!==spec.away||game.timeTbd||!String(game.kickoff||'').startsWith(spec.kickoff))return {state:'outside_source_event'};
  const sourceUrl=`https://www.sofistadium.com/events/detail/${spec.slug}`;
  const checked=Date.parse(snapshot?.checkedAt),page=snapshot?.pages?.[game.id];
  if(snapshot?.schema!=='event-atlas.sofi-event-pages.v1'||!['ok','partial'].includes(snapshot.status)||snapshot.venueId!=='7065'||!Number.isFinite(checked)||checked>now+60000||now-checked>12*3600000||page?.gameId!==game.id||page?.sourceUrl!==sourceUrl||page.eventDateText!==spec.date||page.eventStartsLocal!==spec.start||!time(page.parkingLotsOpenLocal)||!time(page.doorsOpenLocal)||!time(page.detailKickoffLocal)||page.detailKickoffConflictsWithSidebar!==(page.detailKickoffLocal!=='TBD'&&page.detailKickoffLocal!==spec.start)||!(/^[a-f0-9]{64}$/.test(page.sourceTextSha256||'')))return {state:'unavailable',sourceUrl};
  return {state:'current_venue_event_page',asOf:snapshot.checkedAt,sourceUrl,eventStartsLocal:page.eventStartsLocal,parkingLotsOpenLocal:page.parkingLotsOpenLocal,doorsOpenLocal:page.doorsOpenLocal,detailKickoffLocal:page.detailKickoffLocal,detailKickoffConflictsWithSidebar:page.detailKickoffConflictsWithSidebar,sourceTextSha256:page.sourceTextSha256,interpretation:snapshot.interpretation};
}
