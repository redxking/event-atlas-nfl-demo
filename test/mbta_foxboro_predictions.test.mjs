import test from 'node:test';
import assert from 'node:assert/strict';
import {mbtaFoxboroPredictionsUrl,summarizeMbtaFoxboroPredictions} from '../site/mbta_foxboro_predictions.js';

const at=Date.parse('2026-10-09T23:00:00Z');
const prediction=(id,time,stop='FS-0049-S')=>({type:'prediction',id,attributes:{arrival_time:time,departure_time:null,status:null,trip_headsign:null},relationships:{route:{data:{id:'CR-Foxboro'}},stop:{data:{id:stop}},trip:{data:{id:'game-1'}}}});

test('bounded Foxboro estimates retain source times without inferring game service',()=>{
  assert.match(mbtaFoxboroPredictionsUrl,/filter%5Bstop%5D=place-FS-0049/);
  const result=summarizeMbtaFoxboroPredictions({data:[prediction('one','2026-10-09T19:20:00-04:00')],included:[{type:'trip',id:'game-1',attributes:{headsign:'Game train'}}]},at);
  assert.equal(result.state,'retrieved');
  assert.equal(result.entries[0].headsign,'Game train');
  assert.equal(result.entries[0].arrivalAt,'2026-10-09T23:20:00.000Z');
  assert.match(result.interpretation,/Empty results do not establish service cancellation/);
  assert.equal(summarizeMbtaFoxboroPredictions({data:[]},at).state,'retrieved');
});

test('pagination and malformed records keep the current prediction check partial',()=>{
  const result=summarizeMbtaFoxboroPredictions({data:[prediction('wrong-stop','2026-10-09T19:20:00-04:00','OTHER'),prediction('bad-time','bad')],links:{next:'https://api-v3.mbta.com/predictions?page=2'}},at);
  assert.equal(result.state,'partial');
  assert.equal(result.invalidCount,2);
  assert.equal(result.entries.length,0);
  assert.throws(()=>summarizeMbtaFoxboroPredictions({data:new Array(101)},at));
});
