import test from 'node:test';
import assert from 'node:assert/strict';
import {projectVenue,venueMarkers} from '../site/venue_map.js';

test('contiguous-US venue projection preserves the common map bounds',()=>{
  assert.deepEqual(projectVenue(50,-126),{x:0,y:0});
  assert.deepEqual(projectVenue(24,-65),{x:1000,y:570});
  assert.equal(projectVenue(61,-149),null);
});

test('venue markers choose the next game and never imply threat from feed coverage',()=>{
  const now=Date.parse('2026-10-09T18:00:00Z');
  const venue={id:'atl',name:'Atlanta',address:'Atlanta, GA, USA',lat:33.7553,lon:-84.4008,camera:'connected',road:'not_connected'};
  const games=[
    {id:'past',title:'Past game',kickoff:'2026-10-01T20:00:00Z',venue:{id:'atl'}},
    {id:'next',title:'Next game',kickoff:'2026-10-11T20:00:00Z',venue:{id:'atl'}}
  ];
  const marker=venueMarkers([venue],games,now)[0];
  assert.equal(marker.state,'camera');
  assert.equal(marker.gameId,'next');
  assert.ok(marker.x>0&&marker.x<1000&&marker.y>0&&marker.y<570);
  assert.equal(venueMarkers([{...venue,camera:'source_failed'}],games,now)[0].state,'failed');
});
