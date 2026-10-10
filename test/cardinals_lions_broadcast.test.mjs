import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCardinalsLions,cardinalsLionsUrl} from '../site/cardinals_lions_broadcast.js';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';

const now=Date.parse('2026-10-10T15:00:00Z');
const game={id:'nfl:401872991',kickoff:'2026-10-11T20:25Z',timeTbd:false,status:'scheduled in source',venue:{id:'3970',lat:33.527,lon:-112.263}};
const claim=id=>({id,category:'official_event_context',summary:`Official ${id} claim.`,sourceUrl:cardinalsLionsUrl,sourceTextSha256:'a'.repeat(64)});
const snapshot={schema:'event-atlas.cardinals-lions-broadcast.v1',status:'ok',checkedAt:new Date(now).toISOString(),gameId:game.id,eventDate:'2026-10-11',venueId:game.venue.id,sourceUrl:cardinalsLionsUrl,publishedAt:'2026-10-07T15:00:05Z',claims:['event_listing','tv_assignment','radio_assignment'].map(claim)};

test('Cardinals exact-game article enters event source context without a threat cue',()=>{
  const result=selectCardinalsLions(game,snapshot,now);
  assert.equal(result.state,'current_exact_game_article');
  const picture=buildNflEventPicture(game,{cardinalsLionsBroadcast:snapshot},now);
  assert.equal(picture.cardinalsContext.claims.length,3);
  assert.equal(picture.sources.find(item=>item.name==='Cardinals–Lions official game article').sourceUrl,cardinalsLionsUrl);
  assert.equal(picture.assessment.severity,'not_assessed');
  assert.equal(picture.announcedPeople.length,0);
});

test('stale or mismatched Cardinals claims cannot become current context',()=>{
  assert.equal(selectCardinalsLions(game,{...snapshot,checkedAt:new Date(now-13*3600000).toISOString()},now).state,'stale_or_unavailable');
  assert.equal(selectCardinalsLions(game,{...snapshot,venueId:'other'},now).state,'stale_or_unavailable');
  assert.equal(selectCardinalsLions(game,{...snapshot,claims:[claim('event_listing'),claim('event_listing')]},now).state,'stale_or_unavailable');
  assert.equal(selectCardinalsLions({...game,id:'nfl:other'},snapshot,now).state,'outside_source_event');
});
