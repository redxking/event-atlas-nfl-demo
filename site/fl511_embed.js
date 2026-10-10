export const fl511EmbedToolUrl='https://fl511.com/Map/EmbeddedMapSetup';

export function fl511EmbedUrl(game){
  const venue=game?.venue;
  if(venue?.id!=='3948'||!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||venue.lat<25.7||venue.lat>26.2||venue.lon< -80.5||venue.lon> -80.0)return null;
  const url=new URL('https://fl511.com/Map/EmbeddedMap');
  url.search=new URLSearchParams({lat:String(venue.lat),lng:String(venue.lon),zoom:'13',layers:'Closures,Incidents,Cameras',size:'4'}).toString();
  return url.href;
}
