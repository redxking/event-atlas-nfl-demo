import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPackersGameRelease,packersGameReleaseUrls} from '../site/packers_game_release.js';

const now=Date.parse('2026-10-10T06:00:00Z');
const game={id:'nfl:401872990',venue:{id:'3798'},kickoff:'2026-10-11T17:00:00Z',timeTbd:false};
const ids=['parking','fireworks','flyover','anthem','recognition','featured_alumni','franks_gameday','ruettgers_gameday','titletown_alumni'];
const claims=ids.map((id,index)=>({id,category:index<5?'production':'announced_person',summary:`Club announcement ${id}`,names:[],sourceUrl:index<5?packersGameReleaseUrls.event:packersGameReleaseUrls.alumni,sourceTextSha256:'a'.repeat(64)}));
const snapshot={schema:'event-atlas.packers-game-release.v1',status:'ok',checkedAt:'2026-10-10T05:55:00Z',gameId:game.id,eventDate:'2026-10-11',venueId:'3798',sources:Object.entries(packersGameReleaseUrls).map(([id,sourceUrl])=>({id,sourceUrl,state:'checked',publishedAt:'2026-10-08T21:00:00Z'})),claims};

test('official club claims join only the exact game and current source check',()=>{
  const selected=selectPackersGameRelease(game,snapshot,now);
  assert.equal(selected.state,'current_published_announcements');
  assert.equal(selected.claims.length,9);
  assert.equal(selectPackersGameRelease({...game,id:'nfl:other'},snapshot,now).state,'outside_source_event');
  assert.equal(selectPackersGameRelease({...game,kickoff:'2026-10-18T17:00:00Z'},snapshot,now).state,'outside_source_event');
  assert.equal(selectPackersGameRelease(game,{...snapshot,checkedAt:'2026-10-09T00:00:00Z'},now).state,'stale_or_unavailable');
});

test('partial and malformed announcement checks never become a complete club plan',()=>{
  assert.equal(selectPackersGameRelease(game,{...snapshot,status:'partial',claims:claims.slice(1)},now).state,'partial_published_announcements');
  assert.equal(selectPackersGameRelease(game,{...snapshot,claims:[...claims.slice(0,8),{...claims[8],sourceUrl:'https://unapproved.example'}]},now).state,'stale_or_unavailable');
});
