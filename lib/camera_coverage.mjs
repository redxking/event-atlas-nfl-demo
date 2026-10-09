const sourceIds={CA:['caltrans-d4','caltrans-d7'],WA:['wsdot-seattle'],MD:['md-chart-cameras','md-imap-cameras'],IL:['idot-gateway-chicago'],WI:['wisdot-511-green-bay'],PA:['penndot-camera-inventory']};
const agencies={CA:'Caltrans',WA:'WSDOT',MD:'Maryland CHART',IL:'Illinois DOT Gateway',WI:'WisDOT 511',PA:'PennDOT GIS'};
const km=(a,b,c,d)=>{const r=Math.PI/180;return 6371*Math.hypot((d-b)*r*Math.cos((a+c)*r/2),(c-a)*r)};

export function selectCameraCoverage(venues,cameras,sources){
  const available=new Set(sources.filter(source=>source.status==='ok').map(source=>source.id));
  return Object.fromEntries(venues.flatMap(venue=>{
    const state=venue.address.match(/\b([A-Z]{2}), USA$/)?.[1];
    if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lon)||!sourceIds[state]?.some(id=>available.has(id)))return [];
    const items=cameras.filter(camera=>camera.agency===agencies[state])
      .map(camera=>({...camera,distanceKm:Math.round(km(venue.lat,venue.lon,camera.lat,camera.lon)*10)/10}))
      .filter(camera=>camera.distanceKm<=15)
      .sort((a,b)=>a.distanceKm-b.distanceKm)
      .slice(0,5);
    return [[venue.id,items]];
  }));
}
