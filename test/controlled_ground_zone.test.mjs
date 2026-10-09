import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AnalystStore} from '../lib/analyst_store.mjs';
import {normalizeGroundZone,screenControlledGroundZones} from '../lib/controlled_ground_zone.mjs';

const game={id:'nfl:synthetic',kickoff:new Date(Date.now()+86400000).toISOString(),status:'scheduled in source; unreviewed',venue:{id:'synthetic-stadium',lat:40,lon:-75,coordinateStatus:'synthetic candidate'}};
const ring=[[-75.001,39.999],[-74.999,39.999],[-74.999,40.001],[-75.001,40.001],[-75.001,39.999]];
const input=()=>({name:'Synthetic venue zone',purpose:'Local protective planning for a synthetic game.',sourceAuthority:'Synthetic venue operator',sourceReference:'Synthetic plan reference 2026-A',authorityBasis:'Synthetic operator provided this polygon for local planning review.',effectiveFrom:new Date(Date.parse(game.kickoff)-3600000).toISOString(),effectiveUntil:new Date(Date.parse(game.kickoff)+3600000).toISOString(),geometry:{type:'Polygon',coordinates:[ring]}});

test('ground zone geometry is bounded and screening reports only point/time relation',()=>{
  const zone=normalizeGroundZone(input(),game);
  assert.equal(zone.eventId,game.id);
  assert.throws(()=>normalizeGroundZone({...input(),geometry:{type:'Polygon',coordinates:[[ring[0],ring[2],ring[1],ring[3],ring[0]]]}},game),/crosses itself|area/);
  assert.throws(()=>normalizeGroundZone({...input(),geometry:{type:'Polygon',coordinates:[[[-76,40],...ring.slice(1,-1),[-76,40]]]}},game),/over 5 km/);
  const approved={...zone,id:'zone-1',status:'approved_for_local_screening',revokedAt:null};
  const now=Date.parse(game.kickoff)+1000;
  assert.equal(screenControlledGroundZones([approved],game,{lat:40,lon:-75,observedAt:game.kickoff},now)[0].relation,'inside');
  assert.equal(screenControlledGroundZones([approved],game,{lat:40,lon:-75.001,observedAt:game.kickoff},now)[0].relation,'boundary_review');
  assert.equal(screenControlledGroundZones([approved],game,{lat:40.01,lon:-75,observedAt:game.kickoff},now)[0].relation,'outside');
  assert.equal(screenControlledGroundZones([approved],game,{lat:40,lon:-75,observedAt:new Date(Date.parse(game.kickoff)-7200000).toISOString()},now)[0].timeRelation,'before_effective_window');
  assert.deepEqual(screenControlledGroundZones([{...approved,revokedAt:new Date().toISOString()}],game,{lat:40,lon:-75,observedAt:game.kickoff},now),[]);
});

test('local zone approval, revocation, access and tamper checks',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-ground-')),file=path.join(dir,'private','analyst.sqlite');
  try{
    const store=new AnalystStore(file),a=store.createOperator('zone_analyst','Zone Analyst','analyst'),r=store.createOperator('zone_reviewer','Zone Reviewer','reviewer'),other=store.createOperator('zone_other','Other Analyst','analyst');
    const owner=store.authenticate(`Bearer ${a}`),reviewer=store.authenticate(`Bearer ${r}`),outsider=store.authenticate(`Bearer ${other}`);
    const c=store.createCase(owner,{type:'published_event',sourceId:'nfl',id:game.id,title:'Synthetic NFL game',sourceUrl:'https://example.org/game'},'Synthetic NFL event protective planning.','Synthetic venue authority','Synthetic NFL event requires a bounded planning zone.');
    const zone=store.createGroundZone(owner,c.id,normalizeGroundZone(input(),game));
    assert.equal(store.listGroundZonesFor(outsider,c.id),null);
    assert.throws(()=>store.reviewGroundZone(reviewer,zone.id,'approved_for_local_screening','Synthetic source verified by reviewer.','Synthetic plan 2026-A'),/assigned reviewer/);
    store.assignCaseReviewer(owner,c.id,reviewer.id,'Independent review of the synthetic ground zone.');
    assert.throws(()=>store.reviewGroundZone(owner,zone.id,'approved_for_local_screening','Synthetic source verified by reviewer.','Synthetic plan 2026-A'),/Reviewer decision/);
    store.reviewGroundZone(reviewer,zone.id,'approved_for_local_screening','Synthetic venue operator plan checked for this event.','Synthetic plan 2026-A');
    assert.equal(store.listGroundZonesFor(owner,c.id)[0].status,'approved_for_local_screening');
    store.revokeGroundZone(owner,zone.id,'Synthetic venue operator withdrew this planning polygon.');
    assert.equal(store.listGroundZonesFor(reviewer,c.id)[0].revokedBy,owner.id);
    store.close();
    const reopened=new AnalystStore(file);assert.equal(reopened.listGroundZonesFor(owner,c.id)[0].status,'approved_for_local_screening');reopened.close();
    const db=new DatabaseSync(file);db.prepare('UPDATE ground_zones SET payload_json=? WHERE id=?').run('{}',zone.id);db.close();
    assert.throws(()=>new AnalystStore(file),/Ground zone integrity mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
