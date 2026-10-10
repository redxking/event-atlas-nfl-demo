import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFaaReportHint,faaRecordQuery,summarizeDirectFaa} from '../site/report_live_faa.js';
import {renderPublicReportHtml} from '../scripts/render_public_report_html.mjs';

const context={gameId:'nfl:401872984',home:'Tennessee Titans',away:'Houston Texans',kickoff:'2026-10-11T17:00:00Z'};
const record={objectId:4804,sourceGameId:'aa94b527-4feb-11f1-abca-2c54536568a9',eventName:'Houston Texans @ Tennessee Titans',venueName:'Nissan Stadium',startAt:'2026-10-11T16:00:00Z'};
const snapshot={sourceUrl:'https://services1.arcgis.com/n4Ot9Qz0t5espY4s/arcgis/rest/services/SEAMS_Production_View/FeatureServer/0',byGame:{[context.gameId]:record}};
const attributes={OBJECTID:4804,GAME_DETAIL_ID:record.sourceGameId,EVENT_NAME:record.eventName,VENUE:record.venueName,GAME_DATE:Date.parse(record.startAt),END_DATE:Date.parse('2026-10-11T21:00:00Z'),STATUS:'SCHEDULED',IS_ACTIVE:0,updatedAt:Date.parse('2026-10-07T21:22:27Z')};
const now=Date.parse('2026-10-10T12:00:00Z');

test('FAA direct query binds the publisher record to the exact game identity',()=>{
  const hint=selectFaaReportHint(snapshot,context);
  assert.equal(hint.objectId,4804);
  const query=new URL(faaRecordQuery(hint));
  assert.equal(query.searchParams.get('where'),'OBJECTID=4804');
  assert.equal(query.searchParams.get('returnGeometry'),'false');
  assert.equal(selectFaaReportHint(snapshot,{...context,home:'Other Team'}),null);
  assert.equal(selectFaaReportHint({...snapshot,sourceUrl:'https://other.example/layer'},context),null);
});

test('FAA direct summary rejects a changed event or malformed status instead of asserting airspace state',()=>{
  const hint=selectFaaReportHint(snapshot,context);
  const result=summarizeDirectFaa({features:[{attributes}]},hint,context,now);
  assert.equal(result.state,'checked');
  assert.equal(result.isActive,false);
  assert.equal(result.sourceUpdatedAt,'2026-10-07T21:22:27.000Z');
  assert.equal(summarizeDirectFaa({features:[]},hint,context,now).state,'unavailable');
  assert.equal(summarizeDirectFaa({features:[{attributes:{...attributes,GAME_DETAIL_ID:'changed'}}]},hint,context,now).state,'mismatch');
  assert.equal(summarizeDirectFaa({features:[{attributes:{...attributes,VENUE:'Other Stadium'}}]},hint,context,now).state,'mismatch');
  assert.equal(summarizeDirectFaa({features:[{attributes:{...attributes,GAME_DATE:null}}]},hint,context,now).state,'mismatch');
});

test('published report includes the direct FAA airspace panel',()=>{
  const html=renderPublicReportHtml('# Source review',{title:'Source review',generatedAt:'2026-10-10T12:00:00Z',markdownPath:'nfl-401872984.md',liveContext:{venueId:'3810',gameId:context.gameId,home:context.home,away:context.away,kickoff:context.kickoff}});
  assert.match(html,/report_live_faa\.js/);
  assert.match(html,/id="direct-faa"/);
});
