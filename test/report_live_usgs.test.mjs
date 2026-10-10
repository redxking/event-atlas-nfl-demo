import test from 'node:test';
import assert from 'node:assert/strict';
import {directUsgsEligible,summarizeDirectUsgs} from '../site/report_live_usgs.js';

const now=Date.parse('2026-10-10T16:00:00Z');
const context={monitoringMode:'near_term_monitoring',lat:36.16,lon:-86.77,kickoff:'2026-10-11T17:00:00Z',status:'scheduled'};
const feature={id:'exercise123',geometry:{type:'Point',coordinates:[-86.8,36.2,5]},properties:{title:'M 3.0 exercise record',mag:3,time:now-600000,updated:now-300000,url:'https://earthquake.usgs.gov/earthquakes/eventpage/exercise123'}};
const feed={type:'FeatureCollection',metadata:{generated:now-60000},features:[feature]};

test('direct USGS report checks a current bounded nearby record',()=>{
  assert.equal(directUsgsEligible(context,now),true);
  const result=summarizeDirectUsgs(context,feed,now,now);
  assert.equal(result.state,'current_snapshot');
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].sourceUrl,feature.properties.url);
  assert.ok(result.events[0].distanceKm<250);
});

test('direct USGS report rejects stale data and out-of-window checks',()=>{
  assert.throws(()=>summarizeDirectUsgs(context,{...feed,metadata:{generated:now-2*3600000}},now,now),/stale/);
  assert.throws(()=>summarizeDirectUsgs(context,feed,now-6*60000,now),/stale/);
  assert.equal(directUsgsEligible({...context,lat:0},now),false);
  assert.equal(directUsgsEligible({...context,status:'postponed'},now),false);
  assert.equal(directUsgsEligible(context,Date.parse('2026-10-01T16:00:00Z')),false);
});
