import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeNjTransitRailFeed,selectNjTransitRailForGame} from '../site/njtransit_event_rail.js';
import {diffEventPicture} from '../site/event_picture_changes.js';

const now=Date.parse('2026-10-10T03:00:00Z');
const game={id:'nfl:1',kickoff:'2026-10-11T17:00:00Z',venue:{id:'3839'},teams:[{name:'Cleveland Browns'},{name:'New York Jets'}]};
const xml=title=>`<?xml version="1.0"?><rss><channel><title>NJ TRANSIT RAIL ADVISORIES</title><pubDate>Fri, 09 Oct 2026 22:45:00 -0400</pubDate><item><description>${title}</description><link>https://www.njtransit.com/node/2180575</link><pubDate>Oct 07, 2026 11:27:45 AM</pubDate></item></channel></rss>`;
test('exact game, venue and local date yield a linked rail planning advisory',()=>{
  const snapshot=summarizeNjTransitRailFeed(xml('NJ TRANSIT Rail Service to MetLife Stadium for Jets vs. Browns – Sunday, October 11, 2026'),[game],now);
  const selected=selectNjTransitRailForGame(game,snapshot,now);
  assert.equal(selected.state,'event-specific advisory listed');
  assert.equal(selected.advisories.length,1);
});
test('wrong team, date or venue never matches another game',()=>{
  for(const title of ['Rail to MetLife Stadium for Giants vs. Browns – Sunday, October 11, 2026','Rail to MetLife Stadium for Jets vs. Browns – Sunday, October 18, 2026','Rail for Jets vs. Browns – Sunday, October 11, 2026']){
    const snapshot=summarizeNjTransitRailFeed(xml(title),[game],now);
    assert.equal(selectNjTransitRailForGame(game,snapshot,now).advisories.length,0);
  }
});
test('stale feed cannot provide a current advisory',()=>{
  assert.throws(()=>summarizeNjTransitRailFeed(xml('MetLife Stadium for Jets vs. Browns – Sunday, October 11, 2026'),[game],now+3*3600000));
});
test('a newly listed exact-game advisory enters the bounded change history without a threat cue',()=>{
  const source={name:'NJ TRANSIT event rail advisories',state:'event-specific advisory listed',sourceUrl:'https://www.njtransit.com/travel-alerts-to'};
  const prior={eventId:game.id,sources:[source],cues:[],njTransitRailContext:{state:'event-specific advisory listed',gameDate:'2026-10-11',advisories:[]}};
  const next={eventId:game.id,sources:[source],cues:[],njTransitRailContext:{state:'event-specific advisory listed',gameDate:'2026-10-11',advisories:[{title:'Jets vs. Browns rail plan',url:'https://www.njtransit.com/node/2180575'}]}};
  const changes=diffEventPicture(prior,next,null,null,{kickoff:game.kickoff},{kickoff:game.kickoff});
  assert.equal(changes.find(item=>item.kind==='new_event_rail_advisory')?.sourceUrl,'https://www.njtransit.com/node/2180575');
  assert.equal(next.cues.length,0);
});
