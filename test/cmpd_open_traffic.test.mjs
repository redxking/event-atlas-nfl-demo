import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCmpdOpenTraffic,cmpdOpenTrafficFeed} from '../site/cmpd_open_traffic.js';

test('CMPD open-traffic context keeps approximate counts and excludes individual details',()=>{
  const now=Date.parse('2026-10-09T22:00:00Z');
  const records=[{lat:'35.226',lon:'-80.853',publishedAt:'2026-10-09T21:00:00Z',title:'Synthetic private detail'},
    {lat:'35.4',lon:'-80.8',publishedAt:'2026-10-09T20:00:00Z'},
    {lat:'91',lon:'-80.853',publishedAt:'2026-10-09T21:00:00Z'}];
  const result=summarizeCmpdOpenTraffic(records,{lat:35.2258,lon:-80.8528},now);
  assert.equal(result.state,'partial');assert.equal(result.nearby,1);assert.equal(result.invalidCount,1);assert.equal(result.totalOpen,3);
  assert.equal(result.sourceUrl,cmpdOpenTrafficFeed);
  assert.doesNotMatch(JSON.stringify(result),/Synthetic private detail|35\.226/);
  const future=summarizeCmpdOpenTraffic([{lat:35.2,lon:-80.8,publishedAt:'2026-10-10T00:00:00Z'}],{lat:35.2258,lon:-80.8528},now);
  assert.equal(future.state,'partial');assert.equal(future.nearby,0);
});

test('malformed CMPD entries preserve valid context without crashing or inventing a clear feed',()=>{
  const now=Date.parse('2026-10-09T22:00:00Z'),venue={lat:35.2258,lon:-80.8528};
  const result=summarizeCmpdOpenTraffic([null,[],{lat:'35.226',lon:'-80.853',publishedAt:'2026-10-09T21:00:00Z'}],venue,now);
  assert.equal(result.state,'partial');assert.equal(result.invalidCount,2);assert.equal(result.nearby,1);
  assert.throws(()=>summarizeCmpdOpenTraffic([],{lat:91,lon:0},now));
  assert.throws(()=>summarizeCmpdOpenTraffic([],venue,1e20));
});
