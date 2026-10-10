import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCoverageRow,buildSourceCoverage,renderSourceCoverage} from '../lib/published_source_coverage.mjs';
const now=Date.parse('2026-10-10T17:00:00Z');
const bundle=(id,kickoff,venue='v1')=>({schema:'event-atlas.public-evidence-bundle.v1',status:'unreviewed_public_source_export',event:{id,title:'Away at Home',kickoff},venue:{id:venue,name:'Venue '+venue},generatedAt:new Date(now).toISOString(),reportMonitoringMode:'near_term_monitoring',picture:{sources:[{name:'Public feed',state:'stale or unavailable',asOf:null,detail:'Coverage gap',sourceUrl:'https://example.gov/feed'}],gaps:['No verified camera view']}});
test('coverage selects nearest upcoming game per venue and retains source semantics',()=>{
  const rows=[sourceCoverageRow(bundle('nfl:1','2026-10-09T17:00Z')),sourceCoverageRow(bundle('nfl:2','2026-10-12T17:00Z')),sourceCoverageRow(bundle('nfl:3','2026-10-11T17:00Z')),sourceCoverageRow(bundle('nfl:4','2026-10-09T17:00Z','v2'))];
  const coverage=buildSourceCoverage(rows,now);
  assert.equal(coverage.reportCount,4);assert.equal(coverage.venues.length,2);
  assert.equal(coverage.venues[0].eventId,'nfl:3');
  assert.equal(coverage.venues[0].sources[0].state,'stale or unavailable');
  assert.equal(coverage.venues[0].sources[0].reportedTime,null);
  assert.equal(coverage.venues[1].eventId,'nfl:4');
});
test('coverage strips unsafe source URLs and escapes publisher text in HTML',()=>{
  const input=bundle('nfl:1','2026-10-11T17:00Z');
  input.picture.sources[0].name='<img src=x onerror=alert(1)>';
  input.picture.sources[0].sourceUrl='javascript:alert(1)';
  input.picture.sources[0].detail='<script>bad</script>';
  const row=sourceCoverageRow(input);assert.equal(row.sources[0].sourceUrl,null);
  const html=renderSourceCoverage(buildSourceCoverage([row],now));
  assert.doesNotMatch(html,/<script>|<img|javascript:/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/Not supplied/);
});
