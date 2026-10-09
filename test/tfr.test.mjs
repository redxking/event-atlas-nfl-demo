import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectTfrVenueIntersections} from '../site/tfr_relevance.js';

const venue={id:'test',lat:40,lon:-75};
const ring=[[-76,39],[-74,39],[-74,41],[-76,41],[-76,39]];
const list=[{notam_id:'6/1234',type:'SECURITY',description:'Public summary',state:'PA'}];
const feature=(key,coordinates=ring)=>({geometry:{type:'Polygon',coordinates:[coordinates]},properties:{NOTAM_KEY:key}});

test('FAA TFR connector links a source notice only when its published shape contains the venue point',()=>{
  const found=selectTfrVenueIntersections([venue],list,{features:[feature('6/1234-1-FDC-F')]});
  assert.equal(found.test[0].notamId,'6/1234');
  assert.match(found.test[0].matchBasis,/exact effective hours.*unverified/i);
  assert.match(found.test[0].detailUrl,/tfr\.faa\.gov/);
  assert.equal(selectTfrVenueIntersections([{...venue,lon:-70}],list,{features:[feature('6/1234-1-FDC-F')]}).test,undefined);
});

test('FAA TFR connector excludes unlisted or malformed source geometry and deduplicates shapes',()=>{
  const found=selectTfrVenueIntersections([venue],list,{features:[feature('6/1234-1-FDC-F'),feature('6/1234-2-FDC-F'),feature('6/9999-1-FDC-F'),feature('bad-key')]});
  assert.equal(found.test.length,1);
  assert.equal(found.test[0].shapeCount,2);
  assert.throws(()=>selectTfrVenueIntersections([venue],list,{features:new Array(300)}),/incomplete/);
});

test('published FAA TFR snapshot is explicitly spatial and carries no drone detection claim',()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('../site/tfr.json',import.meta.url)));
  assert.equal(snapshot.venueCount,30);
  assert.match(snapshot.basis,/Exact effective hours and NOTAM text require separate verification/);
  assert.match(snapshot.basis,/no drone detection/i);
  for(const items of Object.values(snapshot.byVenue))for(const item of items){
    assert.match(item.detailUrl,/^https:\/\/tfr\.faa\.gov\/tfr3\//);
    assert.ok(item.ring.length>=4);
  }
});
