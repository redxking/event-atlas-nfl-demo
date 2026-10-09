import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectTfrVenueIntersections} from '../site/tfr_relevance.js';
import {parseTfrNotam,tfrAtKickoff} from '../site/tfr_notam.js';

const venue={id:'test',lat:40,lon:-75};
const ring=[[-76,39],[-74,39],[-74,41],[-76,41],[-76,39]];
const list=[{notam_id:'6/1234',type:'SECURITY',description:'Public summary',state:'PA'}];
const feature=(key,coordinates=ring)=>({geometry:{type:'Polygon',coordinates:[coordinates]},properties:{NOTAM_KEY:key}});

test('FAA TFR connector links a source notice only when its published shape contains the venue point',()=>{
  const found=selectTfrVenueIntersections([venue],list,{features:[feature('6/1234-1-FDC-F')]});
  assert.equal(found.test[0].notamId,'6/1234');
  assert.match(found.test[0].matchBasis,/spatial relation alone/i);
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
  assert.match(snapshot.basis,/Single explicit UTC windows are parsed/);
  assert.match(snapshot.basis,/no drone detection/i);
  for(const items of Object.values(snapshot.byVenue))for(const item of items){
    assert.match(item.detailUrl,/^https:\/\/tfr\.faa\.gov\/tfr3\//);
    assert.ok(item.ring.length>=4);
  }
});

test('FAA NOTAM parser accepts one explicit UTC window and screens only the listed kickoff',()=>{
  const text='Beginning Date and Time : October 11, 2026 at 1930 UTC Ending Date and Time : October 12, 2026 at 0200 UTC Reason for NOTAM : Large public gathering Type : UAS Public Gathering Replaced NOTAM(s) : N/A Effective Date(s): From October 11, 2026 at 1930 UTC To October 12, 2026 at 0200 UTC';
  const notice=parseTfrNotam('6/8693',[{notam_id:'6/8693',text}]);
  assert.equal(notice.windowState,'single_explicit_utc_window');
  assert.equal(tfrAtKickoff({kickoff:'2026-10-12T00:20:00Z'},notice),'listed_kickoff_within_notam_window');
  assert.equal(tfrAtKickoff({kickoff:'2026-10-18T00:20:00Z'},notice),'listed_kickoff_outside_notam_window');
});

test('FAA NOTAM parser does not screen recurring, permanent, or multi-area notices as one continuous window',()=>{
  const wrap=(beginning,ending,effective)=>[{notam_id:'6/1234',text:`Beginning Date and Time : ${beginning} Ending Date and Time : ${ending} Reason for NOTAM : Security Type : VIP Replaced NOTAM(s) : N/A ${effective}`}];
  assert.equal(parseTfrNotam('6/1234',wrap('October 11, 2026 UTC 0100-0659 Daily','October 12, 2026 UTC','Effective Date(s): Daily')).windowState,'complex_or_unverified');
  assert.equal(parseTfrNotam('6/1234',wrap('Effective Immediately','Permanent','')).windowState,'standing_permanent');
  assert.equal(parseTfrNotam('6/1234',wrap('October 11, 2026 at 1930 UTC','October 12, 2026 at 0200 UTC','Effective Date(s): A Effective Date(s): B')).windowState,'complex_or_unverified');
  assert.equal(parseTfrNotam('6/1234',wrap('Effective Immediately','Permanent','')).reason,'VIP movement restriction');
});
