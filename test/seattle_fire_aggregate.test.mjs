import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seattleFireAggregateQuery,summarizeSeattleFireAggregate,selectSeattleFireAggregate} from '../site/seattle_fire_aggregate.js';
import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';
import {buildNflPublicReport} from '../site/nfl_public_report.js';
import {buildLocalAiPacket} from '../lib/local_ai_brief.mjs';

const read=name=>JSON.parse(readFileSync(new URL(`../site/${name}`,import.meta.url)));
const schedule=read('nfl.json'),snapshot=read('seattle_fire_aggregate.json');
const game=schedule.games.find(item=>item.id==='nfl:401872992');
const now=Date.parse(snapshot.checkedAt)+1000;

test('Socrata request asks only for a bounded area count and source time',()=>{
  const query=seattleFireAggregateQuery(now),url=new URL(query.url);
  assert.equal(url.searchParams.get('$select'),'count(*) as nearby,max(datetime) as latest');
  assert.match(url.searchParams.get('$where'),/within_circle\(report_location,47\.595277777,-122\.331666666,5000\)/);
  for(const field of ['address','type','incident_number'])assert.equal(url.href.includes(field),false);
  const metadata={id:'kzjm-xkqj',name:'Seattle Real Time Fire 911 Calls',rowsUpdatedAt:Math.floor(now/1000)-120};
  const summary=summarizeSeattleFireAggregate([{nearby:'14',latest:'2026-10-09T23:39:00.000'}],metadata,query,now);
  assert.equal(summary.nearbyCount,14);
  assert.equal(summary.radiusKm,5);
  const empty=summarizeSeattleFireAggregate([{nearby:'0',latest:null}],metadata,query,now);
  assert.equal(empty.nearbyCount,0);
  assert.equal(selectSeattleFireAggregate(game,empty,now).state,'recent_area_count');
  for(const field of ['address','incident_number','response_type'])assert.equal(JSON.stringify(summary).includes(field),false);
  assert.throws(()=>summarizeSeattleFireAggregate([{nearby:'14'}],{...metadata,rowsUpdatedAt:Math.floor(now/1000)-3600},query,now),/stale/);
});

test('Lumen brief and Qwen packet carry a dated count without an incident claim',()=>{
  const context=selectSeattleFireAggregate(game,snapshot,now);
  assert.equal(context.state,'recent_area_count');
  assert.equal(context.nearbyCount,snapshot.nearbyCount);
  const bundle=buildNflEvidenceBundle(game,{schedule,seattleFireAggregate:snapshot},now);
  const report=buildNflPublicReport(bundle);
  assert.match(report,/Seattle Fire public dispatch aggregate/);
  assert.match(report,/no incident address, ID, dispatch type or individual record is stored/i);
  const brief={event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:schedule.builtAt,evidence:bundle}};
  const packet=buildLocalAiPacket(brief,{now});
  assert.equal(packet.evidence.find(item=>item.id==='J1')?.sourceUrl,snapshot.sourceUrl);
  assert.equal(selectSeattleFireAggregate(game,snapshot,now+3*3600000).state,'stale_or_unavailable');
});
