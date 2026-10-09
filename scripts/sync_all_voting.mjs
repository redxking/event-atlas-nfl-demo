import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reconcileVotingSnapshot} from '../lib/voting_snapshot.mjs';
import {archiveVotingRun} from '../lib/voting_history.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const python=process.env.EVENT_ATLAS_PYTHON||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
if(!fs.existsSync(python))throw Error(`Python with pdfplumber is required; set EVENT_ATLAS_PYTHON (checked ${python})`);
const snapshot=path.join(dir,'../data/voting_locations.json');
const history=path.join(dir,'../data/voting_history');
const previous=fs.existsSync(snapshot)?fs.readFileSync(snapshot):null;
let archivePath=null;
try{
  for(const [command,args] of [
    [process.execPath,[path.join(dir,'sync_voting_locations.mjs')]],
    [python,[path.join(dir,'sync_maryland_voting.py')]],
    [process.execPath,[path.join(dir,'sync_pennsylvania_voting.mjs')]],
    [python,[path.join(dir,'sync_north_carolina_voting.py')]],
    [python,[path.join(dir,'sync_washington_voting.py')]],
    [python,[path.join(dir,'sync_south_carolina_voting.py')]],
    [python,[path.join(dir,'sync_west_virginia_voting.py')]],
    [python,[path.join(dir,'sync_delaware_voting.py')]],
    [python,[path.join(dir,'sync_florida_voting.py')]],
    [python,[path.join(dir,'sync_connecticut_voting.py')]],
    [python,[path.join(dir,'sync_new_jersey_voting.py')]]
  ]){
    const result=spawnSync(command,args,{stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status!==0)throw Error(`${path.basename(args[0])} exited ${result.status}`);
  }
  const candidate=JSON.parse(fs.readFileSync(snapshot,'utf8'));
  const reconciled=reconcileVotingSnapshot(previous?JSON.parse(previous):null,candidate);
  fs.writeFileSync(snapshot+'.tmp',JSON.stringify(reconciled));
  fs.renameSync(snapshot+'.tmp',snapshot);
  archivePath=archiveVotingRun(history,reconciled);
  console.log(`Voting comparison: ${reconciled.changeSet.items.length} changes; ${reconciled.changeSet.retainedSources.length} retained sources; archived ${path.basename(archivePath)}`);
}catch(error){
  if(archivePath&&fs.existsSync(archivePath))fs.unlinkSync(archivePath);
  if(previous)fs.writeFileSync(snapshot,previous);
  else if(fs.existsSync(snapshot))fs.unlinkSync(snapshot);
  if(fs.existsSync(snapshot+'.tmp'))fs.unlinkSync(snapshot+'.tmp');
  throw error;
}
