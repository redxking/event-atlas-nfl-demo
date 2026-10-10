import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectSofiContext,renderSofiContext} from '../site/sofi_context.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const work=JSON.parse(await readFile(new URL('../site/metro_i105_notice.json',import.meta.url)));
const now=Date.parse(work.checkedAt);
const game={id:'nfl:401872989',title:'Broncos at Chargers',week:5,kickoff:'2026-10-11T20:05:00Z',status:'scheduled in source',timeTbd:false,venue:{id:'7065',name:'SoFi Stadium'},teams:[{role:'home',name:'Los Angeles Chargers'},{role:'away',name:'Denver Broncos'}]};

test('screen and export share the same dated source comparison',()=>{
  const inputs={metroI105Notice:work};
  const selected=selectSofiContext(game,inputs,now);
  const bundle=buildNflEvidenceBundle(game,inputs,now);
  for(const key of Object.keys(selected))assert.deepEqual(bundle[key],selected[key]);
  assert.equal(bundle.metroI105Notice.overlapMinutes,55);
  assert.match(renderSofiContext(selected),/55 minutes overlap/);
  assert.match(buildNflPublicReport(bundle),/55 minutes; source ends 185 minutes/);
});

test('stale sources lose the comparison and another venue has no SoFi panel',()=>{
  const selected=selectSofiContext(game,{metroI105Notice:work},now+13*3600000);
  assert.equal(selected.metroI105Notice.state,'unavailable');
  assert.doesNotMatch(renderSofiContext(selected),/55 minutes overlap/);
  assert.match(renderSofiContext(selected),/Source unavailable or stale/);
  assert.equal(renderSofiContext(selectSofiContext({...game,venue:{id:'other'}},{},now)),'');
});

test('source content is escaped and unsafe source links cannot become HTML',()=>{
  const context=selectSofiContext(game,{metroI105Notice:work},now);
  context.metroI105Notice.route='<img src=x onerror=alert(1)>';
  context.metroI105Notice.sourceUrl='javascript:alert(1)';
  const html=renderSofiContext(context);
  assert.match(html,/&lt;img/);
  assert.doesNotMatch(html,/<img|href="javascript:/);
});
