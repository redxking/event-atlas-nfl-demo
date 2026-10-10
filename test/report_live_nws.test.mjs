import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeDirectNws} from '../site/report_live_nws.js';

const game={kickoff:'2026-10-11T17:00:00Z',timeTbd:false,status:'scheduled'};
const alert=(url='https://api.weather.gov/alerts/urn:oid:test')=>({id:url,properties:{'@id':url,event:'Severe Thunderstorm Warning',severity:'Severe',urgency:'Immediate',status:'Actual',effective:'2026-10-11T16:00:00Z',ends:'2026-10-11T18:00:00Z'}});

test('direct NWS summary labels overlap without claiming venue impact',()=>{
  const checked=Date.parse('2026-10-11T16:30:00Z');
  const result=summarizeDirectNws(game,{type:'FeatureCollection',features:[alert()]},checked,checked);
  assert.equal(result.candidateCount,1);
  assert.equal(result.alerts[0].url,'https://api.weather.gov/alerts/urn:oid:test');
  assert.equal(result.alerts[0].candidate,true);
});

test('invalid, stale, and off-domain alert data cannot become a linked review cue',()=>{
  const checked=Date.parse('2026-10-11T16:30:00Z');
  assert.throws(()=>summarizeDirectNws(game,{type:'FeatureCollection',features:Array(101).fill(alert())},checked,checked),/Invalid/);
  assert.throws(()=>summarizeDirectNws(game,{type:'FeatureCollection',features:[alert()]},checked-6*60000,checked),/time screened/);
  const result=summarizeDirectNws(game,{type:'FeatureCollection',features:[alert('https://example.com/alerts/1')]},checked,checked);
  assert.equal(result.alerts[0].url,null);
});
