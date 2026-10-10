import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeNj511Events,selectNj511ForGame} from '../site/nj511_events.js';

const now=Date.parse('2026-10-10T03:20:00Z');
const game={id:'nfl:1',kickoff:'2026-10-11T17:00:00Z',venue:{id:'3839',lat:40.81346,lon:-74.07429},teams:[{name:'New York Jets'},{name:'Cleveland Browns'}]};
const item=(title,description,point='40.81346 -74.07429')=>`<item><title>${title}</title><description>${description}</description><pubDate>Fri, 09 Oct 2026 22:00:00 -0400</pubDate><georss:point>${point}</georss:point></item>`;
const xml=items=>`<rss><channel><title>All NJ Active Events</title><pubDate>Fri, 09 Oct 2026 23:00:00 -0400</pubDate>${items}</channel></rss>`;

test('exact MetLife game listing and bounded nearby road context remain separate',()=>{
  const feed=xml(item('MetLife Stadium  : football game','NY Jets vs Cleveland Browns, Sunday October 11th, 2026, 01:00 PM thru 04:00 PM')+item('NJ 3 westbound : Construction','Roadwork near East Rutherford Sunday October 11th, 2026 until 8 AM','40.78422 -74.04776')+item('NJ 120 northbound : Roadwork','Roadwork Wednesday October 21st, 2026','40.81346 -74.07429')+item('I-95 northbound : Crash','Crash far away','40.2 -74.5'));
  const context=selectNj511ForGame(game,summarizeNj511Events(feed,[game],now),now);
  assert.equal(context.state,'exact game listed');
  assert.equal(context.eventListings.length,1);
  assert.equal(context.gameDateRoadCount,1);
  assert.match(context.gameDateRoads[0].title,/NJ 3/);
});
test('different teams and dates do not create an exact game listing',()=>{
  const feed=xml(item('MetLife Stadium  : football game','NY Giants vs Cleveland Browns, Sunday October 11th, 2026')+item('MetLife Stadium  : football game','NY Jets vs Cleveland Browns, Sunday October 18th, 2026'));
  const context=selectNj511ForGame(game,summarizeNj511Events(feed,[game],now),now);
  assert.equal(context.state,'source checked; game unmatched');
  assert.equal(context.eventListings.length,0);
});
test('stale 511NJ feed cannot represent current road context',()=>{
  assert.throws(()=>summarizeNj511Events(xml(''),[game],now+3*3600000),/stale/);
});
