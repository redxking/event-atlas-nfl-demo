import {cameraSourceIdsForVenue} from '../site/venue_source_scope.js';
const agencies={CA:'Caltrans',WA:'WSDOT',MD:'Maryland CHART',GA:'Georgia DOT GIS',IL:'Illinois DOT Gateway',WI:'WisDOT 511',PA:'PennDOT GIS',MN:'MnDOT IRIS',MA:'MassDOT staging GIS',TX:'TxDOT GIS',NJ:'NJTA',TN:'TDOT SmartWay',MO:'MoDOT Traveler Information'};
const km=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};

export function selectCameraCoverage(venues,cameras,sources){
  const available=new Set(sources.filter(source=>source.status==='ok').map(source=>source.id));
  return Object.fromEntries(venues.flatMap(venue=>{
    const state=venue.address.match(/\b([A-Z]{2}), USA$/)?.[1];
    if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||!agencies[state]||!cameraSourceIdsForVenue(venue).some(id=>available.has(id)))return [];
    if(state==='TX'&&(venue.lat<32.68||venue.lat>32.85||venue.lon< -97.25||venue.lon> -96.9))return [];
    const items=cameras.filter(camera=>camera.agency===agencies[state])
      .map(camera=>({...camera,distanceKm:Math.round(km(venue.lat,venue.lon,camera.lat,camera.lon)*10)/10}))
      .filter(camera=>camera.distanceKm<=15)
      .sort((a,b)=>a.distanceKm-b.distanceKm)
      .slice(0,5);
    return [[venue.id,items]];
  }));
}
