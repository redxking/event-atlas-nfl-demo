export function compareJetsTravelPlan(game,guide,rail,road){
  if(game?.id!=='nfl:401872983'||game?.venue?.id!=='3839')return {state:'outside_source_event'};
  const guideCurrent=guide?.state==='current_published_plan';
  const railExact=rail?.state==='event-specific advisory listed'&&Array.isArray(rail.advisories)&&rail.advisories.length>0;
  const roadExact=road?.state==='exact game listed'&&Array.isArray(road.eventListings)&&road.eventListings.length>0;
  return {
    state:guideCurrent&&railExact&&roadExact?'three_publishers_list_game_plan':'incomplete_source_alignment',
    guideCurrent,railExact,roadExact,
    roadDateCandidates:Number.isSafeInteger(road?.gameDateRoadCount)?road.gameDateRoadCount:null,
    guideUrl:guide?.sourceUrl||null,railUrl:rail?.advisories?.[0]?.url||rail?.sourceUrl||null,roadUrl:road?.sourceUrl||null,
    summary:guideCurrent&&railExact&&roadExact?'Jets game-day access guidance, an NJ TRANSIT exact-game rail advisory, and a 511NJ exact-game listing are concurrently published for the Jets–Browns game. Verify the current operating state with each publisher.':'One or more exact-game access, rail, or 511NJ source checks are absent or stale; no service or traffic conclusion follows.',
    interpretation:'Agreement that an event is planned is not confirmation that a train runs, a road is open or closed, a gate operates, or a person attends. Nearby date-matched road entries are review candidates only.'
  };
}
