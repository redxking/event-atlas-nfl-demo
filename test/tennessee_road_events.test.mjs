import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTennesseeRoadEvents} from '../lib/tennessee_road_events.mjs';

test('Tennessee source-listed incident preserves description without mislabeling local wall time as UTC',()=>{
  const now=Date.parse('2026-10-09T20:53:00Z'),source='https://spatial.tdot.tn.gov/ArcGIS/rest/services/Smartway/Smartway_Events/FeatureServer/0';
  const feature={attributes:{OBJECTID:611800,START_DATE:1791560468000,END_DATE:null,REVISED_DATE:1791560668000,EVENT_TYPE:'Incident',EVENT_SUBTYPE:'Multi-Vehicle Crash',DESCRIPTION:'Crash reported at 10/09/2026 3:41 PM (CT).',HAS_CLOSURE:1},geometry:{x:-86.744417,y:36.147577}};
  const rows=parseTennesseeRoadEvents([feature],now,Date.parse('2027-01-10T00:00:00Z'),source);
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'tdot-smartway-611800');
  assert.equal(rows[0].detail,feature.attributes.DESCRIPTION);
  assert.equal(rows[0].startAt,null);
  assert.equal(rows[0].sourceRecordDate,null);
  assert.equal(rows[0].timingPolicy,'source_listed_only');
  assert.deepEqual(parseTennesseeRoadEvents([{...feature,attributes:{...feature.attributes,REVISED_DATE:now-2*86400000}}],now,Date.parse('2027-01-10T00:00:00Z'),source),[]);
});
