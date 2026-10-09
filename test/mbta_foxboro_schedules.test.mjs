import test from 'node:test';
import assert from 'node:assert/strict';
import {foxboroServiceDate,mbtaFoxboroSchedulesUrl,summarizeMbtaFoxboroSchedules} from '../site/mbta_foxboro_schedules.js';

const game={id:'nfl:test',kickoff:'2026-10-11T17:00:00Z',timeTbd:false,status:'scheduled in source',venue:{id:'3738'}};
const checkedAt=Date.parse('2026-10-09T23:00:00Z');
const schedule=(id,arrival,departure,stop='FS-0049-S')=>({type:'schedule',id,attributes:{arrival_time:arrival,departure_time:departure,direction_id:0},relationships:{route:{data:{id:'CR-Foxboro'}},stop:{data:{id:stop}},trip:{data:{id:'PatsTrain-1'}}}});
const included=[{type:'trip',id:'PatsTrain-1',attributes:{headsign:'Patriots Game Train'}}];

test('official Foxboro station schedules stay service context with Eastern service date',()=>{
  assert.equal(foxboroServiceDate(game),'2026-10-11');
  assert.match(mbtaFoxboroSchedulesUrl(game),/filter%5Bdate%5D=2026-10-11/);
  const result=summarizeMbtaFoxboroSchedules({data:[schedule('one','2026-10-11T11:05:00-04:00',null)],included,links:{next:null}},game,checkedAt);
  assert.equal(result.state,'retrieved');
  assert.equal(result.arrivalCount,1);
  assert.equal(result.withinWindowCount,1);
  assert.equal(result.departureCount,0);
  assert.equal(result.entries[0].headsign,'Patriots Game Train');
  assert.match(result.interpretation,/not real-time train positions/);
});

test('malformed or paginated Foxboro schedule cannot be complete negative coverage',()=>{
  const result=summarizeMbtaFoxboroSchedules({data:[schedule('bad','not-a-time',null),schedule('wrong','2026-10-11T11:05:00-04:00',null,'FS-9999-S')],included,links:{next:'https://api-v3.mbta.com/schedules?page=2'}},game,checkedAt);
  assert.equal(result.state,'partial');
  assert.equal(result.invalidCount,2);
  assert.equal(result.arrivalCount,0);
  assert.equal(summarizeMbtaFoxboroSchedules({data:[],included:[]},{...game,timeTbd:true},checkedAt).screenable,false);
  assert.equal(summarizeMbtaFoxboroSchedules({data:[]},game,checkedAt).state,'retrieved');
  assert.equal(summarizeMbtaFoxboroSchedules({data:[schedule('one','2026-10-11T11:05:00-04:00',null)]},game,checkedAt).state,'partial');
  assert.throws(()=>foxboroServiceDate({...game,venue:{id:'3628'}}));
});
