import test from 'node:test';
import assert from 'node:assert/strict';
import {directNifcEligible,nifcDirectQueryUrl,summarizeDirectNifc} from '../site/report_live_nifc.js';
import {renderPublicReportHtml} from '../scripts/render_public_report_html.mjs';

const now=Date.parse('2026-10-10T16:00:00Z');
const context={monitoringMode:'near_term_monitoring',lat:33.9535,lon:-118.3392,kickoff:'2026-10-11T20:00:00Z',status:'scheduled'};
const feature={attributes:{OBJECTID:42,IncidentName:'Example incident',IncidentTypeCategory:'WF',IncidentSize:12,ModifiedOnDateTime_dt:now-60000,FireDiscoveryDateTime:now-3600000,FireOutDateTime:null,PercentContained:25},geometry:{x:-118.34,y:33.93}};

test('direct NIFC query is limited to an eligible event area and returns source-linked points',()=>{
  assert.equal(directNifcEligible(context,now),true);
  const url=new URL(nifcDirectQueryUrl(context,now));
  assert.equal(url.hostname,'services3.arcgis.com');
  assert.equal(url.searchParams.get('geometryType'),'esriGeometryEnvelope');
  assert.equal(url.searchParams.get('where'),"IncidentTypeCategory = 'WF'");
  const [xmin,ymin,xmax,ymax]=url.searchParams.get('geometry').split(',').map(Number);
  assert.ok(xmin<context.lon&&xmax>context.lon&&ymin<context.lat&&ymax>context.lat);
  const selected=summarizeDirectNifc(context,{features:[feature]},now,now);
  assert.equal(selected.state,'current_snapshot');
  assert.deepEqual(selected.events.map(item=>item.id),[42]);
  assert.ok(selected.events[0].distanceKm<150);
  assert.match(selected.events[0].sourceUrl,/\/42$/);
});

test('direct NIFC refuses incomplete or stale checks rather than reporting zero nearby points',()=>{
  assert.throws(()=>summarizeDirectNifc(context,{features:[],exceededTransferLimit:true},now,now),/incomplete/);
  assert.throws(()=>summarizeDirectNifc(context,{features:[]},now-6*60000,now),/stale/);
  assert.equal(directNifcEligible({...context,status:'postponed'},now),false);
  assert.equal(directNifcEligible({...context,lat:0},now),false);
  assert.equal(directNifcEligible(context,Date.parse('2026-10-01T16:00:00Z')),false);
});

test('published report includes the direct NIFC panel and module',()=>{
  const html=renderPublicReportHtml('# Report',{title:'Report',generatedAt:new Date(now).toISOString(),markdownPath:'nfl-42.md',liveContext:{monitoringMode:context.monitoringMode,lat:context.lat,lon:context.lon,kickoff:context.kickoff,status:context.status}});
  assert.ok(html.includes('report_live_nifc.js?v=20261010-2'));
  assert.ok(html.includes('id="direct-nifc"'));
});
