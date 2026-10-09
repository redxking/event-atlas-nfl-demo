import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const filename=/^(\d{13})-([0-9a-f-]{36})-([0-9a-f]{64})\.json\.gz$/;
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

export function readVotingHistory(directory){
  if(!fs.existsSync(directory))return [];
  const entries=fs.readdirSync(directory).filter(name=>name.endsWith('.json.gz')).sort();
  const history=[];
  for(const name of entries){
    const match=filename.exec(name);
    if(!match)throw Error(`Unexpected voting archive filename: ${name}`);
    const bytes=fs.readFileSync(path.join(directory,name));
    const archiveHash=sha256(bytes);
    if(archiveHash!==match[3])throw Error(`Voting archive checksum mismatch: ${name}`);
    const envelope=JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
    if(envelope.schemaVersion!==1||envelope.snapshot?.changeSet?.runId!==match[2]||envelope.previousArchiveHash!==(history.at(-1)?.archiveHash||null)){
      throw Error(`Voting archive chain mismatch: ${name}`);
    }
    const snapshot=envelope.snapshot;
    const kinds={};
    for(const change of snapshot.changeSet.items)kinds[change.kind]=(kinds[change.kind]||0)+1;
    history.push({name,archiveHash,runId:match[2],archivedAt:envelope.archivedAt,
                  backfilled:!!envelope.backfilled,recordCount:snapshot.locations.length,
                  sourceCount:snapshot.sources.length,sourceStatuses:snapshot.sources.map(s=>({id:s.id,status:s.status,records:s.records})),
                  snapshotDigest:snapshot.changeSet.digest,changeCount:snapshot.changeSet.items.length,
                  changeKinds:kinds,retainedSources:snapshot.changeSet.retainedSources});
  }
  return history;
}

export function archiveVotingRun(directory,snapshot,{backfilled=false}={}){
  const runId=snapshot.changeSet?.runId;
  if(!/^[0-9a-f-]{36}$/.test(runId||''))throw Error('Voting snapshot requires a run ID');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const history=readVotingHistory(directory);
  if(history.some(entry=>entry.runId===runId))throw Error(`Voting run already archived: ${runId}`);
  const envelope={schemaVersion:1,archivedAt:new Date().toISOString(),backfilled,
                  previousArchiveHash:history.at(-1)?.archiveHash||null,snapshot};
  const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(envelope)),{level:9});
  const timestamp=Math.max(Date.now(),Number(history.at(-1)?.name.slice(0,13)||0)+1);
  const name=`${timestamp}-${runId}-${sha256(bytes)}.json.gz`;
  const temporary=path.join(directory,`.${name}.tmp`),final=path.join(directory,name);
  try{
    const fd=fs.openSync(temporary,'wx',0o600);
    try{fs.writeSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    fs.renameSync(temporary,final);
    return final;
  }catch(error){if(fs.existsSync(temporary))fs.unlinkSync(temporary);throw error}
}
