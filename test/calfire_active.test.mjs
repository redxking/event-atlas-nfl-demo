import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCalfireActive,calfireCountyContext} from '../site/calfire_active.js';

const html=`<table id="incidents"><caption>Currently Active Incidents</caption><thead><tr><th>Incident</th></tr></thead><tbody>
<tr><th scope="row"><a href="/incidents/2026/10/3/bouquet-fire">Bouquet Fire</a></th><td>Los Angeles</td><td>10/03/2026</td><td>1,048</td><td><div>83% <span></span></div></td></tr>
<tr><th scope="row"><a href="/incidents/2026/10/9/other-fire">Other Fire</a></th><td>Santa Clara, San Mateo</td><td>10/09/2026</td><td>10</td><td><div>5%</div></td></tr>
</tbody></table>`;
const now=Date.parse('2026-10-10T16:00:00Z');

test('CAL FIRE active table retains official incident links and county scope',()=>{
  const snapshot=parseCalfireActive(html,'2026-10-10T15:55:00Z');
  const la=calfireCountyContext(snapshot,'7065',now);
  assert.equal(la.state,'current_county_listing');
  assert.equal(la.incidents.length,1);
  assert.equal(la.incidents[0].acres,1048);
  assert.equal(la.incidents[0].sourceUrl,'https://www.fire.ca.gov/incidents/2026/10/3/bouquet-fire');
  assert.deepEqual(calfireCountyContext(snapshot,'4738',now).incidents.map(item=>item.name),['Other Fire']);
  assert.equal(calfireCountyContext(snapshot,'7065',now+13*3600000).state,'unavailable');
  assert.equal(calfireCountyContext(snapshot,'3673',now).state,'outside_source_area');
});

test('CAL FIRE table parser fails closed on unexpected source structure',()=>{
  assert.throws(()=>parseCalfireActive('<table id="incidents"><caption>Archive</caption></table>'),/active table/);
  assert.throws(()=>parseCalfireActive(html.replace('83%','803%')),/Invalid CAL FIRE/);
});
