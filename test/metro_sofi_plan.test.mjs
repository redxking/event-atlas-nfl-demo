import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMetroSofiPlan,selectMetroSofiPlan} from '../site/metro_sofi_plan.js';

const html=`<h2>SoFi Stadium Express</h2><p>Take the SoFi Stadium Express for Rams and Chargers Games</p><ol><li>Board the SoFi Stadium Express at <strong>Bus Bay 8</strong> at the LAX/Metro Transit Center Station</li><li>Buses run every 10 minutes or less, beginning 3 hours before kickoff</li><li>Return service starts at the beginning of the 4th quarter, with buses running every 5 minutes for 90 minutes after the game</li></ol>`;
const now=Date.parse('2026-10-10T16:00:00Z');
const game={venue:{id:'7065'},teams:[{name:'Denver Broncos',role:'away'},{name:'Los Angeles Chargers',role:'home'}],kickoff:'2026-10-11T20:05:00Z',status:'scheduled',timeTbd:false};

test('Metro SoFi plan retains operator scope and derives only an illustrative pregame start',()=>{
  const snapshot=parseMetroSofiPlan(html,'2026-10-10T15:59:00Z');
  const result=selectMetroSofiPlan(game,snapshot,now);
  assert.equal(result.state,'published_operator_plan');
  assert.equal(result.illustrativeOutboundStart,'2026-10-11T17:05:00.000Z');
  assert.equal(result.boarding,'Bus Bay 8, LAX/Metro Transit Center Station');
  assert.equal(selectMetroSofiPlan({...game,teams:[{name:'Buffalo Bills',role:'away'},{name:'Los Angeles Rams',role:'home'}]},snapshot,now).state,'published_operator_plan');
  assert.equal(selectMetroSofiPlan({...game,venue:{id:'4738'}},snapshot,now).state,'outside_source_event');
});

test('Metro SoFi plan fails closed when source terms, freshness or kickoff change',()=>{
  const snapshot=parseMetroSofiPlan(html,'2026-10-10T15:59:00Z');
  assert.throws(()=>parseMetroSofiPlan(html.replace('Bus Bay 8','Bus Bay 4')), /changed or unavailable/);
  assert.equal(selectMetroSofiPlan(game,snapshot,now+13*3600000).state,'unavailable');
  assert.equal(selectMetroSofiPlan({...game,timeTbd:true},snapshot,now).state,'kickoff_unverified');
  assert.equal(selectMetroSofiPlan({...game,status:'postponed'},snapshot,now).state,'kickoff_unverified');
});
