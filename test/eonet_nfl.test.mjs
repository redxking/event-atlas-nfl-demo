import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEonetNflSnapshot,selectEonetForGame,eonetSourceUrl} from '../site/eonet_nfl.js';

const now=Date.parse('2026-10-10T04:00:00Z');
const game={id:'nfl:1',venue:{id:'venue-1',lat:34.0,lon:-118.0}};
const feature=(id,date,lon,lat,extras={})=>({type:'Feature',properties:{id,title:`Event ${id}`,date,closed:null,link:`https://eonet.gsfc.nasa.gov/api/v3/events/${id}/geojson`,categories:[{title:'Wildfires'}],...extras},geometry:{type:'Point',coordinates:[lon,lat]}});

test('latest NASA geometry controls regional match and stale historical points do not linger',()=>{
  const raw={type:'FeatureCollection',features:[
    feature('EONET_1','2026-10-09T04:00:00Z',-118.1,34.1),
    feature('EONET_1','2026-10-10T02:00:00Z',-125,34),
    feature('EONET_2','2026-10-10T01:00:00Z',-118.5,34.2),
    feature('EONET_3','2026-10-01T01:00:00Z',-118.1,34.1)
  ]};
  const snapshot=buildEonetNflSnapshot(raw,[game],now);
  assert.equal(snapshot.status,'ok');
  assert.deepEqual(snapshot.byVenue['venue-1'].map(item=>item.id),['EONET_2']);
  assert.equal(snapshot.byVenue['venue-1'][0].sourceUrl,'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_2/geojson');
  assert.equal(selectEonetForGame(game,snapshot,now).events.length,1);
  assert.equal(selectEonetForGame(game,snapshot,now,'season_planning').state,'not_started');
  assert.equal(selectEonetForGame(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
});

test('NASA source and geometry validation prevents unsupported or unlinked records',()=>{
  const wrongHost=feature('EONET_1','2026-10-10T01:00:00Z',-118.1,34.1,{link:'https://example.com/event'});
  const line=feature('EONET_2','2026-10-10T02:00:00Z',-118.1,34.1);
  line.geometry={type:'LineString',coordinates:[[-118.1,34.1],[-118.2,34.2]]};
  const snapshot=buildEonetNflSnapshot({type:'FeatureCollection',features:[wrongHost,line]},[game],now);
  assert.equal(snapshot.sourceUrl,eonetSourceUrl);
  assert.equal(Object.keys(snapshot.byVenue).length,0);
  assert.throws(()=>buildEonetNflSnapshot({type:'FeatureCollection',features:new Array(5001)},[game],now),/Invalid bounded/);
});
