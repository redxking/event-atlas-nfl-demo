import test from 'node:test';
import assert from 'node:assert/strict';
import {selectHoustonTranstarRss} from '../site/houston_transtar_rss.js';

const now=Date.parse('2026-10-24T13:05:00Z');
const game={id:'nfl:houston',kickoff:'2026-10-25T17:00:00Z',timeTbd:false,venue:{id:'3891'}};
const checkedAt='2026-10-24T13:04:00Z',sourceAt='2026-10-24T13:00:00Z';
const feed=(kind,entries=[])=>({status:'ok',sourceAt,totalListed:entries.length,corridorListed:entries.length,entries,sourceUrl:`https://traffic.houstontranstar.org/data/rss/${kind==='incidents'?'incidents':'laneclosures'}_rss.xml`});
const entry={id:'1854994_Verified',title:'IH-610 South Loop Eastbound Before Scott St - Stall',description:'Status: Verified at 7:32 AM',sourceAt,sourceTextSha256:'a'.repeat(64),sourceUrl:'https://traffic.houstontranstar.org/data/rss/incidents_rss.xml'};
const snapshot={schema:'event-atlas.houston-transtar-rss.v1',status:'ok',checkedAt,feeds:{incidents:feed('incidents',[entry]),lane_closures:feed('lane_closures')}};

test('Houston RSS remains corridor context without geocoded or event-time claim',()=>{
  const selected=selectHoustonTranstarRss(game,snapshot,now);
  assert.equal(selected.state,'current_corridor_text_sample');
  assert.equal(selected.entries.length,1);
  assert.equal(selected.entries[0].statusText,'Verified');
  assert.equal(selected.entries[0].lat,undefined);
});

test('Houston RSS excludes other venues, stale checks and malformed source entries',()=>{
  assert.equal(selectHoustonTranstarRss({...game,venue:{id:'3970'}},snapshot,now).state,'outside_houston_scope');
  assert.equal(selectHoustonTranstarRss(game,{...snapshot,checkedAt:'2026-10-24T09:00:00Z'},now).state,'stale_or_unavailable');
  assert.equal(selectHoustonTranstarRss(game,{...snapshot,feeds:{...snapshot.feeds,incidents:feed('incidents',[{...entry,title:'Other road'}])}},now).state,'stale_or_unavailable');
});
