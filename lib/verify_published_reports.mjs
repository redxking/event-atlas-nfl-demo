import {createHash} from 'node:crypto';
import {publishedNflReportMode} from './nfl_game_lifecycle.mjs';

export async function verifyPublishedReports(index,schedule,readBytes){
  const scopeAt=Date.parse(index?.scopeAt),builtAt=Date.parse(index?.builtAt);
  if(index?.status!=='ok'||!Array.isArray(index.reports)||index.reports.length>300||!Number.isFinite(scopeAt)||!Number.isFinite(builtAt)||scopeAt>builtAt||!Array.isArray(schedule?.games)||schedule.source?.status!=='ok'||index.scheduleBuiltAt!==schedule.builtAt)throw Error('Invalid report or schedule manifest');
  const expected=new Map(schedule.games.filter(game=>publishedNflReportMode(game,scopeAt)).map(game=>[game.id,game]));
  if(index.reports.length!==expected.size)throw Error('Published report coverage differs from schedule scope');
  const seen=new Set();let evidenceBytes=0;
  for(const entry of index.reports){
    const game=expected.get(entry.eventId);
    if(!game||seen.has(entry.eventId)||!/^nfl:\d+$/.test(entry.eventId))throw Error('Unknown or duplicate report event');
    seen.add(entry.eventId);
    const id=entry.eventId.replace(':','-');
    if(entry.path!==`reports/${id}.html`||entry.markdownPath!==`reports/${id}.md`||entry.evidencePath!==`reports/${id}.evidence.json`||! /^[a-f0-9]{64}$/.test(entry.evidenceSha256))throw Error('Invalid report artifact path or digest');
    const bytes=await readBytes(entry.evidencePath);
    if(bytes.length!==entry.evidenceBytes||createHash('sha256').update(bytes).digest('hex')!==entry.evidenceSha256)throw Error(`Evidence bytes mismatch: ${entry.eventId}`);
    const bundle=JSON.parse(bytes.toString('utf8'));
    if(bundle.schema!=='event-atlas.public-evidence-bundle.v1'||bundle.status!=='unreviewed_public_source_export'||bundle.event?.id!==entry.eventId||bundle.generatedAt!==entry.generatedAt||bundle.venue?.id!==game.venue.id||bundle.event.kickoff!==game.kickoff||bundle.reportMonitoringMode!==publishedNflReportMode(game,scopeAt))throw Error(`Evidence identity mismatch: ${entry.eventId}`);
    for(const file of [entry.path,entry.markdownPath]){
      const text=(await readBytes(file)).toString('utf8');
      if(!text.includes(entry.evidenceSha256)||!text.includes(`${id}.evidence.json`))throw Error(`Evidence binding missing: ${file}`);
    }
    evidenceBytes+=bytes.length;
  }
  return {verifiedReports:seen.size,evidenceBytes,scopeAt:index.scopeAt};
}
