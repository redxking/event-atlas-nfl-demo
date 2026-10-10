import test from 'node:test';
import assert from 'node:assert/strict';
import {selectGreenBayAlertsForGame} from '../site/green_bay_alerts.js';

const now=Date.parse('2026-10-10T06:35:00Z');
const game={venue:{id:'3798'}};
const source=(kind,alerts=[])=>({status:'ok',kind,sourceUrl:`https://www.greenbaywi.gov/RSSFeed.aspx?CID=${kind==='emergency'?'Emergency-Alerts-11':'Police-Department-Alerts-12'}&ModID=63`,sourceBuiltAt:'2026-10-10T06:34:47Z',alerts});
const snapshot={schema:'event-atlas.green-bay-alerts.v1',status:'ok',builtAt:'2026-10-10T06:35:00Z',sources:[source('emergency'),source('police')]};

test('empty current city categories are checked without claiming safety',()=>{
  const selected=selectGreenBayAlertsForGame(game,snapshot,now);
  assert.equal(selected.state,'current_snapshot');
  assert.equal(selected.alerts.length,0);
  assert.equal(selectGreenBayAlertsForGame({venue:{id:'3806'}},snapshot,now).state,'outside_source_city');
  assert.equal(selectGreenBayAlertsForGame(game,{...snapshot,builtAt:'2026-10-10T05:35:00Z'},Date.parse('2026-10-10T05:35:00Z')).sources[0].publisherClockAhead,true);
});

test('one failed category makes coverage partial while retaining official items',()=>{
  const alert={kind:'emergency',title:'City notice',detail:'City context',url:'https://www.greenbaywi.gov/AlertCenter.aspx?AID=123',publishedAt:'2026-10-10T06:00:00Z'};
  const selected=selectGreenBayAlertsForGame(game,{...snapshot,sources:[source('emergency',[alert]),{...source('police'),status:'failed'}]},now);
  assert.equal(selected.state,'partial');
  assert.deepEqual(selected.alerts,[alert]);
  assert.equal(selectGreenBayAlertsForGame(game,{...snapshot,builtAt:'2026-10-10T01:00:00Z'},now).state,'stale_or_unavailable');
});
