import test from 'node:test';
import assert from 'node:assert/strict';
import {closestWzdxPoint,parseWzdxNearVenue} from '../lib/wzdx_road_events.mjs';

const now=Date.parse('2026-10-09T21:00:00Z');
const venue={id:'stadium',lat:40,lon:-74};
const options={agency:'Publisher WZDx',sourceUrl:'https://example.gov/wzdx'};
const feature=(id,geometry,more={})=>({id,type:'Feature',geometry,properties:{core_details:{event_type:'work-zone',road_names:['I-1'],description:'Published work zone',update_date:'2026-10-09T20:00:00Z'},start_date:'2026-10-01T00:00:00Z',end_date:'2026-10-20T00:00:00Z',...more}});

test('closest road segment is used instead of first line endpoint',()=>{
  const point=closestWzdxPoint({type:'LineString',coordinates:[[-74.2,40],[-73.8,40]]},40,-74);
  assert.ok(point.distanceKm<0.01);
  assert.ok(Math.abs(point.lon+74)<0.0001);
  assert.ok(closestWzdxPoint({type:'MultiPoint',coordinates:[[-75,40],[-74.01,40]]},40,-74).distanceKm<1);
});

test('fresh WZDx feed supplies bounded spatial context without kickoff-time matching',()=>{
  const feed={type:'FeatureCollection',feed_info:{update_date:'2026-10-09T20:55:00Z'},features:[
    feature('near',{type:'LineString',coordinates:[[-74.2,40],[-73.8,40]]}),
    feature('old',{type:'MultiPoint',coordinates:[[-74,40]]},{end_date:'2026-10-08T00:00:00Z'}),
    feature('far',{type:'MultiPoint',coordinates:[[-75,40]]})
  ]};
  const records=parseWzdxNearVenue(feed,venue,now,Date.parse('2027-01-10T00:00:00Z'),options);
  assert.equal(records.length,1);
  assert.equal(records[0].id,'wzdx-near');
  assert.equal(records[0].timingPolicy,'source_listed_only');
  assert.equal(records[0].startAt,null);
  assert.equal(records[0].distanceKm,0);
  assert.throws(()=>parseWzdxNearVenue({...feed,feed_info:{update_date:'2026-10-07T20:00:00Z'}},venue,now,Date.parse('2027-01-10T00:00:00Z'),options),/older than 24 hours/);
});

test('DriveNC repeated source features become one traceable road activity',()=>{
  const geometry={type:'LineString',coordinates:[[-74.02,40],[-73.98,40]]};
  const make=(id,start,end,description='Ramp closure. Id: 6817')=>feature(id,geometry,{core_details:{event_type:'work-zone',road_names:['I-1'],description,update_date:'2026-10-09T20:00:00Z'},start_date:start,end_date:end});
  const feed={type:'FeatureCollection',feed_info:{update_date:'2026-10-09T20:55:00Z'},features:[
    make('hash-a','2026-10-10T00:00:00Z','2026-10-11T00:00:00Z'),
    make('hash-b','2026-10-10T00:00:00Z','2026-10-11T00:00:00Z'),
    make('hash-c','2026-10-17T00:00:00Z','2026-10-18T00:00:00Z'),
    make('separate','2026-10-10T00:00:00Z','2026-10-11T00:00:00Z','Other closure. Id: 6818')
  ]};
  const records=parseWzdxNearVenue(feed,venue,now,Date.parse('2027-01-10T00:00:00Z'),{...options,sourceUrl:'https://drivenc.gov/api/wzdx'});
  assert.equal(records.length,2);
  const grouped=records.find(record=>record.detail.includes('6817'));
  assert.match(grouped.id,/^wzdx-drivenc-6817-/);
  assert.equal(grouped.sourceFeatureCount,3);
  assert.equal(grouped.sourceWindowCount,2);
  assert.equal(grouped.startAt,null);
  assert.equal(grouped.endAt,null);
  assert.equal(parseWzdxNearVenue({...feed,features:[...feed.features].reverse()},venue,now,Date.parse('2027-01-10T00:00:00Z'),{...options,sourceUrl:'https://drivenc.gov/api/wzdx'}).find(record=>record.detail.includes('6817')).id,grouped.id);
  assert.equal(parseWzdxNearVenue(feed,venue,now,Date.parse('2027-01-10T00:00:00Z'),options).length,4);
});
