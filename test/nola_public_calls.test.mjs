import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nolaCallQueries,nolaCallsDataset,selectNolaCalls,summarizeNolaCalls} from '../site/nola_public_calls.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';

const schedule=JSON.parse(readFileSync(new URL('../site/nfl.json',import.meta.url)));
const snapshot=JSON.parse(readFileSync(new URL('../site/nola_public_calls.json',import.meta.url)));
const game=schedule.games.find(item=>item.id==='nfl:401872987');
const now=Date.parse(snapshot.builtAt)+1000;

test('New Orleans source requests only a bounded spatial count and dataset freshness',()=>{
  const query=nolaCallQueries(game.venue,Date.parse('2026-10-10T12:00:00Z'));
  const count=new URL(query.countUrl);
  assert.equal(count.searchParams.get('$select'),'count(*) as count');
  assert.match(count.searchParams.get('$where'),/within_circle\(location, 29\.950833333, -90\.081111111, 2000\)/);
  assert.match(count.searchParams.get('$where'),/2026-10-09T00:00:00/);
  assert.equal(new URL(query.latestUrl).searchParams.get('$select'),'max(timecreate) as latest');
  assert.ok(!query.countUrl.includes('block_address')&&!query.countUrl.includes('type_')&&!query.countUrl.includes('nopd_item'));
});

test('preliminary call count enters the Saints brief and model packet without incident claims',()=>{
  const selected=selectNolaCalls(game,snapshot,now);
  assert.equal(selected.state,'provisional_delayed_historical');
  const bundle=buildNflEvidenceBundle(game,{schedule,nolaPublicCalls:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/NOPD\/OPCD preliminary public call aggregate/);
  assert.match(report,/Do not compare counts over time/);
  const packet=buildLocalAiPacket({event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}},{now});
  assert.equal(packet.evidence.find(item=>item.id==='K5')?.sourceUrl,nolaCallsDataset);
  assert.match(packet.evidence.find(item=>item.id==='K5').text,/not an active alert/);
});

test('stale, wrong-venue and malformed source data cannot become a current count',()=>{
  assert.equal(selectNolaCalls(schedule.games.find(item=>item.venue.id!=='3493'),snapshot,now).state,'outside_venue');
  assert.equal(selectNolaCalls(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectNolaCalls(game,{...snapshot,sourceUrl:'https://example.com/'},now).state,'stale_or_unavailable');
  const query=nolaCallQueries(game.venue,now);
  const metadata={id:'es9j-6y5d',rowsUpdatedAt:Math.floor(now/1000)};
  assert.throws(()=>summarizeNolaCalls([{count:'NaN'}],[{latest:'2026-10-09T23:59:00'}],metadata,query,now),/incomplete/);
  const stale=summarizeNolaCalls([{count:'2'}],[{latest:'2026-10-01T00:00:00'}],metadata,query,now);
  assert.equal(stale.state,'stale_source');
});
