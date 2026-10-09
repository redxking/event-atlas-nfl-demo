import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {archiveVotingRun,readVotingHistory} from '../lib/voting_history.mjs';

const snapshot=(runId,items=[])=>({retrievedAt:'2026-10-09T12:00:00Z',locations:[{id:'test:1'}],
  sources:[{id:'test',status:'ok',records:1}],changeSet:{runId,digest:'a'.repeat(64),items,retainedSources:[]}});

test('voting archives retain full runs and detect changed or missing files',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-voting-history-'));
  try{
    const one=snapshot('11111111-1111-4111-8111-111111111111');
    const two=snapshot('22222222-2222-4222-8222-222222222222',[{kind:'changed',siteId:'test:1'}]);
    const first=archiveVotingRun(dir,one,{backfilled:true});
    const second=archiveVotingRun(dir,two);
    const history=readVotingHistory(dir);
    assert.equal(history.length,2);
    assert.equal(history[0].backfilled,true);
    assert.equal(history[1].changeKinds.changed,1);
    assert.equal(history[1].recordCount,1);
    assert.throws(()=>archiveVotingRun(dir,two),/already archived/);
    const bytes=fs.readFileSync(second);fs.writeFileSync(second,Buffer.concat([bytes,Buffer.from('tamper')]));
    assert.throws(()=>readVotingHistory(dir),/checksum mismatch/);
    fs.writeFileSync(second,bytes);fs.unlinkSync(first);
    assert.throws(()=>readVotingHistory(dir),/chain mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
