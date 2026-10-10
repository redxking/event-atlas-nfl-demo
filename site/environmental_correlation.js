const validTime=value=>{const at=Date.parse(value);return Number.isFinite(at)?at:null};

export function correlateEnvironmentalSources(smoke,air,wildfire){
  const smokeCurrent=smoke?.state==='recent_daily_analysis';
  const airCurrent=air?.state==='current_station_observation'&&air.observation;
  const fireCurrent=wildfire?.state==='current_snapshot';
  const polygons=smokeCurrent&&Array.isArray(smoke.polygons)?smoke.polygons:[];
  const measuredAt=airCurrent?validTime(air.observation.observedAt):null;
  const matched=measuredAt==null?null:polygons.find(item=>{
    const start=validTime(item.startAt),end=validTime(item.endAt);
    return start!=null&&end!=null&&start<=measuredAt&&measuredAt<=end;
  });
  const latestEnd=polygons.reduce((latest,item)=>Math.max(latest,validTime(item.endAt)??-Infinity),-Infinity);
  const relationship=!smokeCurrent||!airCurrent?'not_evaluable':!polygons.length?'no_polygon_point_match':matched?'same_published_time_window':measuredAt>latestEnd?'station_observation_after_polygon_windows':'different_published_time_windows';
  const fireCount=fireCurrent&&Array.isArray(wildfire.events)?wildfire.events.length:null;
  const summary={
    not_evaluable:'NOAA smoke analysis and a current nearby EPA PM2.5 observation are not both available for a time comparison.',
    no_polygon_point_match:'The latest NOAA daily analysis has no smoke polygon point match at the venue candidate. A nearby EPA PM2.5 reading is available; the missing polygon match is not an all-clear.',
    same_published_time_window:'A nearby EPA PM2.5 station reading falls within the published time window of a NOAA smoke polygon that contains the venue candidate point. The station and venue are different locations.',
    station_observation_after_polygon_windows:'The nearby EPA PM2.5 station reading was taken after the displayed NOAA smoke polygon windows ended. It cannot confirm conditions during those earlier windows or at kickoff.',
    different_published_time_windows:'The nearby EPA PM2.5 station reading and displayed NOAA smoke polygon windows do not overlap in published time. They cannot be treated as simultaneous observations.'
  }[relationship];
  return {state:relationship,summary,smokeSourceUrl:smoke?.sourceUrl||null,smokeLatestEndAt:Number.isFinite(latestEnd)?new Date(latestEnd).toISOString():null,smokeMatchCount:polygons.length,airSourceUrl:air?.sourceUrl||null,stationId:airCurrent?air.observation.stationId:null,stationDistanceKm:airCurrent?air.observation.distanceKm:null,pm25UgM3:airCurrent?air.observation.pm25UgM3:null,stationObservedAt:airCurrent?air.observation.observedAt:null,nearbyWildfirePointCount:fireCount,wildfireSourceUrl:wildfire?.sourceUrl||null,interpretation:'This compares published times and a venue candidate point only. Satellite smoke is not a ground measurement; a station reading is not measured at the stadium. Nearby wildfire points are not source attribution. No exposure, health threshold, event impact, or threat is inferred.'};
}
