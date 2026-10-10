import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublishedEvidenceArtifact} from '../lib/published_evidence_artifact.mjs';
import {verifyPublishedReports} from '../lib/verify_published_reports.mjs';
const at='2026-10-10T17:00:00Z';
function fixture(){
  const game={id:'nfl:123',kickoff:'2026-10-11T17:00:00Z',status:'scheduled in source; unreviewed',venue:{id:'venue'}};
  const bundle={schema:'event-atlas.public-evidence-bundle.v1',status:'unreviewed_public_source_export',event:game,venue:game.venue,generatedAt:at,reportMonitoringMode:'near_term_monitoring'};
  const artifact=buildPublishedEvidenceArtifact(bundle);
  const entry={eventId:game.id,path:'reports/nfl-123.html',markdownPath:'reports/nfl-123.md',evidencePath:'reports/'+artifact.filename,evidenceSha256:artifact.sha256,evidenceBytes:artifact.byteLength,generatedAt:at};
  const files=new Map([[entry.path,Buffer.from(artifact.section)],[entry.markdownPath,Buffer.from(artifact.section)],[entry.evidencePath,Buffer.from(artifact.bytes)]]);
  return {index:{status:'ok',scopeAt:at,builtAt:at,scheduleBuiltAt:at,reports:[entry]},schedule:{source:{status:'ok'},builtAt:at,games:[game]},files,read:async path=>{if(!files.has(path))throw Error('Missing file');return files.get(path)}};
}
test('all scoped reports have matched saved evidence and both document bindings',async()=>{
  const f=fixture();assert.equal((await verifyPublishedReports(f.index,f.schedule,f.read)).verifiedReports,1);
});
test('publication gate rejects corrupted bytes, omissions, duplicate IDs, wrong scope and missing bindings',async()=>{
  const mutations=[
    f=>f.files.set('reports/nfl-123.evidence.json',Buffer.from('{}')),
    f=>f.files.delete('reports/nfl-123.html'),
    f=>f.files.set('reports/nfl-123.md',Buffer.from('no evidence link')),
    f=>f.index.reports.splice(0,1),
    f=>f.index.reports.push({...f.index.reports[0]}),
    f=>f.index.reports[0].evidencePath='../../private',
    f=>f.index.scheduleBuiltAt='2026-10-09T00:00:00Z',
    f=>f.schedule.games[0].venue.id='another-venue',
    f=>f.schedule.games[0].kickoff='2026-10-20T17:00:00Z'
  ];
  for(const mutate of mutations){const f=fixture();mutate(f);await assert.rejects(()=>verifyPublishedReports(f.index,f.schedule,f.read))}
});
