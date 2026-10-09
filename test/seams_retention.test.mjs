import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('FAA outage retains an older clearly dated snapshot without rewriting it',()=>{
  const file=path.resolve('site/seams.json'),before=fs.readFileSync(file,'utf8');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-faa-outage-'));
  try{
    const mock=path.join(dir,'fail-fetch.mjs');
    fs.writeFileSync(mock,"globalThis.fetch=async()=>{throw Error('synthetic FAA source outage')};\n");
    const result=spawnSync(process.execPath,['--import',mock,'scripts/sync_faa_seams.mjs'],{cwd:process.cwd(),encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stderr,/retained previous snapshot/);
    assert.equal(fs.readFileSync(file,'utf8'),before);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
