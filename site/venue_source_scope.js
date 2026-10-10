const cameraSources={WA:['wsdot-seattle'],MD:['md-chart-cameras','md-imap-cameras'],GA:['gdot-atlanta-cameras'],IL:['idot-gateway-chicago'],WI:['wisdot-511-green-bay'],PA:['penndot-camera-inventory'],MN:['mndot-iris-cameras'],MA:['massdot-staging-cameras'],NJ:['njta-public-road-cameras'],TN:['tdot-smartway-cameras'],LA:['la511-public-cameras']};
const roadSources={WA:['wsdot-road-alerts'],MD:['md-chart-incidents','md-chart-closures'],IL:['idot-closure-incidents'],WI:['wisdot-511-events-green-bay'],LA:['ladotd-511-new-orleans'],TN:['tdot-smartway-nashville'],NJ:['njit-transcom-wzdx'],NC:['ncdot-drivenc-wzdx'],MO:['modot-wzdx'],AZ:['aztech-wzdx'],MN:['mndot-iris-incidents']};
const stateOf=venue=>venue?.address?.match(/\b([A-Z]{2}), USA$/)?.[1];
const caDistrict=venue=>Number.isFinite(venue?.lat)?venue.lat>=35?'4':'7':null;

export function cameraSourceIdsForVenue(venue){
  const state=stateOf(venue);
  if(state==='CA')return caDistrict(venue)?[`caltrans-d${caDistrict(venue)}`]:[];
  if(state==='TX')return Number.isFinite(venue?.lat)&&venue.lat>=32.68&&venue.lat<=32.85&&venue.lon>=-97.25&&venue.lon<=-96.9?['txdot-dfw-camera-assets']:[];
  return cameraSources[state]||[];
}

export function roadSourceIdsForVenue(venue){
  const state=stateOf(venue);
  if(state==='CA')return caDistrict(venue)?[`caltrans-lcs-d${caDistrict(venue)}`]:[];
  return roadSources[state]||[];
}

export function failedSourcesForVenue(venue,sources,kind){
  const ids=new Set(kind==='camera'?cameraSourceIdsForVenue(venue):roadSourceIdsForVenue(venue));
  return (sources||[]).filter(source=>ids.has(source.id)&&source.status==='failed');
}
