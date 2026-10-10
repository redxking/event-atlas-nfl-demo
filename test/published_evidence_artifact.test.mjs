import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPublishedEvidenceArtifact} from '../lib/published_evidence_artifact.mjs';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';

const game={id:'nfl:401872995',title:'Seattle Seahawks at Denver Broncos',kickoff:'2026-10-16T00:15Z',venue:{id:'3937',name:'Empower Field at Mile High'}};
const now=Date.parse('2026-10-10T17:00:00Z');
test('artifact preserves the exact public bundle and binds its UTF-8 bytes to the report',()=>{
  const bundle=buildNflEvidenceBundle(game,{},now);
  bundle.publishedChanges={comparison:'baseline; no comparable previous run',newItems:[]};
  const before=JSON.stringify(bundle);
  const artifact=buildPublishedEvidenceArtifact(bundle);
  assert.deepEqual(JSON.parse(artifact.bytes),bundle);
  assert.equal(artifact.sha256,createHash('sha256').update(Buffer.from(artifact.bytes,'utf8')).digest('hex'));
  assert.equal(artifact.byteLength,Buffer.byteLength(artifact.bytes,'utf8'));
  assert.ok(artifact.section.includes(artifact.sha256));
  assert.ok(artifact.section.includes(artifact.filename));
  assert.equal(JSON.stringify(bundle),before);
  assert.equal(buildPublishedEvidenceArtifact(bundle).sha256,artifact.sha256);
  assert.notEqual(buildPublishedEvidenceArtifact({...bundle,useLimit:'changed'}).sha256,artifact.sha256);
});
test('artifact rejects internal, undated and path-shaped event identities',()=>{
  const bundle=buildNflEvidenceBundle(game,{},now);
  for(const value of [{...bundle,status:'internal_case'},{...bundle,schema:'case.v1'},{...bundle,generatedAt:'invalid'},{...bundle,event:{id:'nfl:../private'}}])assert.throws(()=>buildPublishedEvidenceArtifact(value));
});
