import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMinnesotaCameras,parseMinnesotaIncidents,requireSourceAge} from '../lib/minnesota_iris.mjs';

test('MnDOT source freshness gates camera and active incident snapshots',()=>{
  const now=Date.parse('2026-10-09T21:30:00Z');
  assert.equal(requireSourceAge('Fri, 09 Oct 2026 21:20:00 GMT',now,30*60000),'2026-10-09T21:20:00.000Z');
  assert.throws(()=>requireSourceAge('Fri, 09 Oct 2026 20:00:00 GMT',now,30*60000));
  assert.throws(()=>requireSourceAge(null,now,30*60000));
});

test('MnDOT public camera parser retains only published bounded metadata',()=>{
  const fixture=Array.from({length:500},(_,i)=>({name:`C${i+1}`,publish:true,lat:44.974,lon:-93.258,location:'I-35W @ 3rd St',roadway:'I-35W',streamable:true,views:[{privateUrl:'rtsp://internal'}]}));
  fixture[1].publish=false;
  const rows=parseMinnesotaCameras(fixture);
  assert.equal(rows.length,499);
  assert.equal(rows[0].viewerUrl,'https://511mn.org/cameras');
  assert.equal(rows[0].videoUrl,undefined);
  assert.equal(rows[0].views,undefined);
  assert.throws(()=>parseMinnesotaCameras([]));
});

test('MnDOT incidents are source-listed observations with no future kickoff match',()=>{
  const rows=parseMinnesotaIncidents([{name:'2026100911442340',event_date:'2026-10-09T11:44:23-05:00',description:'Incident ROADWORK',road:'I-35W',direction:'SB',lane_type:'Mainline',confirmed:true,lat:44.974,lon:-93.258}]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].sourceRecordDate,'2026-10-09T16:44:23.000Z');
  assert.equal(rows[0].timingPolicy,'source_listed_only');
  assert.equal(rows[0].startAt,null);
  assert.equal(rows[0].endAt,null);
  assert.equal(rows[0].sourceConfirmed,true);
  assert.deepEqual(parseMinnesotaIncidents([]),[]);
});
