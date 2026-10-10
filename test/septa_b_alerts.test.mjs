import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSeptaFeed,selectSeptaForGame} from '../site/septa_b_alerts.js';
import {buildNflEventPicture} from '../site/nfl_event_picture.js';

const now=Date.parse('2026-10-10T00:30:00Z');
const game={id:'nfl:demo',kickoff:'2026-10-11T17:00:00Z',timeTbd:false,status:'scheduled in source',sourceUrl:'https://example.org/game',venue:{id:'3806',lat:39.9007,lon:-75.1675}};
const period={start:String(Date.parse('2026-10-11T16:00:00Z')/1000),end:String(Date.parse('2026-10-11T20:00:00Z')/1000)};
const alert=(id,selector)=>({id,alert:{informedEntity:[selector],activePeriod:[period],headerText:{translation:[{language:'en',text:'Synthetic service notice'}]},cause:'CONSTRUCTION',effect:'MODIFIED_SERVICE'}});

test('SEPTA feed retains B Line and NRG stop selectors and distinguishes their scope',()=>{
  const feed={header:{timestamp:String((now-60000)/1000)},entity:[alert('route',{routeId:'B1'}),alert('station',{stopId:'1281'}),alert('other',{routeId:'M1'})]};
  const snapshot=summarizeSeptaFeed(feed,now);
  assert.equal(snapshot.matchingCount,2);
  assert.deepEqual(snapshot.alerts.map(item=>item.scope),['B Line route','NRG station stop']);
  const result=selectSeptaForGame(game,snapshot,now);
  assert.equal(result.overlapCount,2);
  const picture=buildNflEventPicture(game,{septa:snapshot},now);
  assert.equal(picture.cueCounts.transit,2);
  assert.equal(picture.cues[0].sourceUrl,'https://www.septa.org/alerts/');
  assert.match(picture.cues[0].basis,/B Line route/);
  assert.deepEqual(picture.assessment,{severity:'not_assessed',confidence:'not_assessed'});
});

test('stale, malformed, partial and unknown-kickoff SEPTA data do not produce review cues',()=>{
  const feed={header:{timestamp:String((now-60000)/1000)},entity:[alert('route',{routeId:'B2'})]};
  assert.throws(()=>summarizeSeptaFeed({...feed,header:{timestamp:String((now-3600000)/1000)}},now),/stale/);
  const snapshot=summarizeSeptaFeed(feed,now);
  assert.equal(buildNflEventPicture(game,{septa:{...snapshot,sourceAt:'2026-10-09T20:00:00Z'}},now).cueCounts.transit,0);
  assert.equal(buildNflEventPicture(game,{septa:{...snapshot,status:'partial'}},now).cueCounts.transit,0);
  assert.equal(buildNflEventPicture({...game,timeTbd:true},{septa:snapshot},now).cueCounts.transit,0);
});
