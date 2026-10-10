import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLiveObservationCapture,livePanelIds} from '../site/report_live_capture.js';

const input={gameId:'nfl:401872989',generatedAt:'2026-10-10T15:48:24Z',capturedAt:'2026-10-10T15:49:00Z',reportUrl:'https://redxking.github.io/event-atlas-nfl-demo/reports/nfl-401872989.html',panels:livePanelIds.map(id=>({id,present:true,text:'Source check completed at 2026-10-10T15:48:51Z.',links:[{label:'Publisher',url:'https://earthquake.usgs.gov/earthquakes/eventpage/ci41345415'}]}))};

test('browser capture binds all visible direct panels to one published game revision',()=>{
  const capture=buildLiveObservationCapture(input);
  assert.equal(capture.gameId,input.gameId);
  assert.equal(capture.publishedReportGeneratedAt,input.generatedAt);
  assert.equal(capture.panels.length,livePanelIds.length);
  assert.equal(capture.panels[3].sourceLinks[0].url,input.panels[3].links[0].url);
  assert.match(capture.interpretation,/not an operational threat assessment/);
});

test('browser capture rejects changed game, incomplete panels, and unsafe source links',()=>{
  assert.throws(()=>buildLiveObservationCapture({...input,gameId:'nfl:other'}),/Invalid/);
  assert.throws(()=>buildLiveObservationCapture({...input,panels:input.panels.slice(1)}),/Invalid/);
  assert.throws(()=>buildLiveObservationCapture({...input,panels:input.panels.map((item,index)=>index===0?{...item,links:[{label:'Bad',url:'http://example.com'}]}:item)}),/Invalid/);
  assert.throws(()=>buildLiveObservationCapture({...input,panels:input.panels.map((item,index)=>index===0?{...item,text:'x'.repeat(6001)}:item)}),/Invalid/);
});
