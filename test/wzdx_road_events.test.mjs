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
