import {createHash} from 'node:crypto';

export function buildPublishedEvidenceArtifact(bundle){
  if(bundle?.schema!=='event-atlas.public-evidence-bundle.v1'||bundle.status!=='unreviewed_public_source_export'||!/^nfl:\d+$/.test(bundle.event?.id||'')||!Number.isFinite(Date.parse(bundle.generatedAt)))throw Error('A dated public NFL evidence bundle is required');
  const filename=`${bundle.event.id.replace(':','-')}.evidence.json`;
  const bytes=JSON.stringify(bundle)+'\n';
  const sha256=createHash('sha256').update(bytes,'utf8').digest('hex');
  const url=`https://redxking.github.io/event-atlas-nfl-demo/reports/${filename}`;
  return {filename,bytes,sha256,byteLength:Buffer.byteLength(bytes,'utf8'),section:`\n## Evidence snapshot for this report\n\n[Download the public evidence bundle (JSON)](${url})\n\n- **Event:** ${bundle.event.id}\n- **Snapshot generated:** ${bundle.generatedAt}\n- **SHA-256 of downloaded bytes:** ${sha256}\n\nThis file contains the public observations, source states, relationships and gaps supplied to this report build. Direct checks performed later in the browser are separate. The download URL serves the latest published snapshot; save the report and JSON together and compare the digest before relying on an older report. A digest verifies file identity, not source truth or analyst approval.\n`};
}
