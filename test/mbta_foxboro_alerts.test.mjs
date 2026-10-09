import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMbtaFoxboroAlerts} from '../site/mbta_foxboro_alerts.js';

const game={id:'nfl:test',kickoff:'2026-10-18T17:00:00Z',timeTbd:false,status:'scheduled in source',venue:{id:'3738',name:'Gillette Stadium'}};
const at=Date.parse('2026-10-09T23:00:00Z');
const alert=(id,start,end)=>({type:'alert',id,attributes:{header:'Synthetic station service change',effect:'SHUTTLE',lifecycle:'UPCOMING',updated_at:'2026-10-09T20:00:00Z',active_period:[{start,end}]}});

test('Foxboro station alert is screened against game time without threat inference',()=>{
  const out=summarizeMbtaFoxboroAlerts({data:[alert('one','2026-10-18T15:00:00Z','2026-10-18T19:00:00Z'),alert('two','2026-10-19T00:00:00Z','2026-10-19T06:00:00Z')],links:{next:null}},game,at);
  assert.equal(out.state,'retrieved');assert.equal(out.overlapCount,1);
  assert.equal(out.alerts[0].id,'one');assert.equal(out.alerts[0].eventWindowOverlap,true);
  assert.match(out.interpretation,/not verified event-train impact/);
  assert.equal(out.stopId,'place-FS-0049');
});

test('pagination and malformed periods cannot be reported as complete negative coverage',()=>{
  const out=summarizeMbtaFoxboroAlerts({data:[alert('bad','not-a-date',null)],links:{next:'https://api-v3.mbta.com/alerts?page=2'}},game,at);
  assert.equal(out.state,'partial');assert.equal(out.invalidCount,1);assert.equal(out.overlapCount,0);
  const tbd=summarizeMbtaFoxboroAlerts({data:[alert('one','2026-10-18T15:00:00Z',null)]},{...game,timeTbd:true},at);
  assert.equal(tbd.screenable,false);assert.equal(tbd.overlapCount,0);
  assert.throws(()=>summarizeMbtaFoxboroAlerts({data:[]},{...game,venue:{id:'3628'}},at));
});

test('evidence export marks alert records beyond its 30-record bound',()=>{
  const out=summarizeMbtaFoxboroAlerts({data:Array.from({length:35},(_,i)=>alert(`id-${i}`,'2026-10-18T15:00:00Z','2026-10-18T19:00:00Z'))},game,at);
  assert.equal(out.totalReturned,35);
  assert.equal(out.overlapCount,35);
  assert.equal(out.alerts.length,30);
  assert.equal(out.omittedAlertCount,5);
});
