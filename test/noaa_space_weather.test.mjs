import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNoaaScales} from '../scripts/sync_noaa_space_weather.mjs';

const fixture=()=>({
  '0':{DateStamp:'2026-10-10',TimeStamp:'10:28:00',G:{Scale:'2'},R:{Scale:'0'},S:{Scale:'1'}},
  '1':{DateStamp:'2026-10-10',TimeStamp:'10:28:00',G:{Scale:'3'},R:{Scale:null},S:{Scale:null}}
});

test('keeps observed scales distinct from outlook probabilities and values',()=>{
  const result=parseNoaaScales(fixture(),'2026-10-10T11:00:00.000Z');
  assert.deepEqual(result.observed.scales,{G:2,R:0,S:1});
  assert.deepEqual(result.outlook[0].scales,{G:3,R:null,S:null});
  assert.equal(result.status,'ok');
});

test('rejects stale current readings and invalid scale values',()=>{
  assert.throws(()=>parseNoaaScales(fixture(),'2026-10-10T17:00:00.000Z'),/stale/);
  const invalid=fixture();invalid['0'].G.Scale='9';
  assert.throws(()=>parseNoaaScales(invalid,'2026-10-10T11:00:00.000Z'),/scale/);
});
