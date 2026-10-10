import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildBriefingReport} from '../site/window_briefing_report.js';
import {briefingStory,presenterScript,displayStatus} from '../site/window_presenter.js';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
import {scenarioStages} from '../site/window_analysis_simulator.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
test('Every game briefing retains citations and does not claim an unmatched AI result',()=>{
 for(const game of games){const brief=replayGameFeed(createGameFeed(game)),report=buildBriefingReport(brief),ids=new Set(brief.observations.map(o=>o.evidenceId));assert(report.items.every(item=>item.evidence.every(id=>ids.has(id))));assert(report.lines.some(line=>line.startsWith('No recorded model result matches')));assert(presenterScript(game).includes(game.title));}
});
test('Empty and stale evidence cannot become an all-clear or an issued alert',()=>{
 const feed=createGameFeed(games[0]),empty=buildBriefingReport(replayGameFeed(feed,0));assert(empty.lines.some(s=>s.includes('insufficient evidence')));
 const full=replayGameFeed(feed),stale=buildBriefingReport(replayGameFeed(feed,35,new Date(Date.parse(full.clock)+31*60000).toISOString()));assert(stale.lines.some(s=>s.includes('26 too old')));assert(stale.lines.some(s=>s.startsWith('No operational alert has been issued')));assert.throws(()=>buildBriefingReport({dataMode:'live'}));
});
test('Presenter stages resolve and review labels retain the need to reassess',()=>{
 assert(briefingStory.every(s=>scenarioStages.some(t=>t.id===s.stage)));assert.match(displayStatus('evidence_changed_review_required'),/review again/);assert.match(displayStatus('updated_evidence_requires_review'),/review needed/);
});
