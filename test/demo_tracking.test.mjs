import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {demoTrackingFrame} from '../site/demo_tracking.js';
const scope=JSON.parse(fs.readFileSync('data/nfl_demo_window_scope.json'));
const games=JSON.parse(fs.readFileSync('site/nfl.json')).games.filter(g=>scope.frozenGameIds.includes(g.id));
test('every window game demonstrates entry, missing data, restoration, exit and expiry',()=>{assert.equal(games.length,27);for(const g of games){const now=1000000;assert.equal(demoTrackingFrame(g,0,now).alert,null);const missing=demoTrackingFrame(g,1,now);assert.ok(missing.alert);assert.match(missing.alert.detail,/not evidence of hostile intent/);assert.equal(demoTrackingFrame(g,2,now).alert,null);assert.equal(demoTrackingFrame(g,3,now).alert,null);assert.equal(demoTrackingFrame(g,4,now).tracks.length,0);assert.equal(demoTrackingFrame(g,4,now).alert,null);}});
test('vessel example is limited to staged Nissan scenario and all positions are fictional',()=>{for(const game of games){const frame=demoTrackingFrame(game,1);assert.equal(frame.tracks.some(t=>t.kind==='vessel'),game.venue.name==='Nissan Stadium');assert.ok(frame.tracks.every(t=>t.classification==='Fictional tracking example'));}});
