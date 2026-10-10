export const fl511EmbedToolUrl='https://fl511.com/Map/EmbeddedMapSetup';
const floridaVenueIds=new Set(['3712','3886','3948']);

export function fl511EmbedUrl(game){
  const venue=game?.venue;
  if(!floridaVenueIds.has(venue?.id)||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||venue.lat<24||venue.lat>31||venue.lon< -88||venue.lon> -80)return null;
  const url=new URL('https://fl511.com/Map/EmbeddedMap');
  url.search=new URLSearchParams({lat:String(venue.lat),lng:String(venue.lon),zoom:'13',layers:'Closures,Incidents,Cameras',size:'4'}).toString();
  return url.href;
}
