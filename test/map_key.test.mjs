import test from 'node:test';
import assert from 'node:assert/strict';
import {eventKey,overviewKey,mapColors} from '../site/map_key.js';
test('key distinguishes counts and concern flags from confirmed threats',()=>{
 const rows=overviewKey();assert.equal(rows.length,3);assert.ok(rows.every(r=>r.shape==='count'));
 assert.match(rows[0].detail,/does not mean cleared/);assert.match(rows[2].label,/weather/);
});
test('event key reflects supplied geometry and keeps stale FAA styling separate from concern amber',()=>{
 const absent=eventKey({nfl:false});assert.deepEqual(absent.map(r=>r.label),['Event location']);
 const old=eventKey({ground:true,airspace:true,concerns:2});const faa=old.find(r=>r.label.includes('FAA'));assert.equal(faa.color,mapColors.oldAirspace);assert.equal(faa.shape,'dashed');assert.notEqual(faa.color,mapColors.concern);
 assert.ok(old.some(r=>r.label==='Source concern location'));
 assert.ok(!old.some(r=>r.label==='Demonstration vessel'));
 const current=eventKey({airspace:true,fresh:true,demoVessel:true});assert.equal(current.find(r=>r.label==='FAA airspace boundary').shape,'area');assert.ok(current.some(r=>r.label==='Demonstration vessel'));
});
test('tracking key uses distinct aircraft and vessel shapes and discloses inference limits',()=>{
 const rows=eventKey();assert.equal(rows.find(r=>r.label==='Received aircraft position').shape,'triangle');
 assert.equal(rows.find(r=>r.label==='Received vessel position').shape,'diamond');
 assert.match(rows.find(r=>r.label==='Aircraft information gap').detail,/not proof of hostile intent/);
 assert.match(rows.find(r=>r.label==='Demonstration monitoring area').detail,/not an FAA restriction/);
});
