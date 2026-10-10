import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePhillyCityAlerts} from '../site/philly_city_alerts.js';

test('Philadelphia city endpoint empty response is a narrow successful check',()=>{
  const result=summarizePhillyCityAlerts([],1000);
  assert.equal(result.state,'retrieved');
  assert.equal(result.totalReturned,0);
  assert.deepEqual(result.alerts,[]);
});

test('Philadelphia notices are bounded, text cleaned, and malformed rows marked partial',()=>{
  const result=summarizePhillyCityAlerts([{title:'  City <b>notice</b> ',message:' Check the city site. ',url:'https://www.phila.gov/notice'},{unknown:'x'}],1000);
  assert.equal(result.state,'partial');
  assert.equal(result.invalidCount,1);
  assert.deepEqual(result.alerts,[{title:'City notice',detail:'Check the city site.',url:'https://www.phila.gov/notice'}]);
  assert.throws(()=>summarizePhillyCityAlerts({alerts:[]},1000),/bounded array/);
  assert.throws(()=>summarizePhillyCityAlerts(Array(21).fill({title:'x'}),1000),/bounded array/);
  assert.equal(summarizePhillyCityAlerts([{title:'x',url:'https://example.com/'}],1000).alerts[0].url,'https://api.phila.gov/phila/site-wide-alerts/v1');
  assert.equal(summarizePhillyCityAlerts([{title:'x'.repeat(500),url:'https://www.phila.gov/'+'a'.repeat(1300)}],1000).alerts[0].title.length,160);
  assert.equal(summarizePhillyCityAlerts([{title:'x',url:'https://www.phila.gov/'+'a'.repeat(1300)}],1000).alerts[0].url,'https://api.phila.gov/phila/site-wide-alerts/v1');
});
