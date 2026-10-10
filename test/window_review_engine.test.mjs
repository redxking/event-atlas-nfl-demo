import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameFeed,replayGameFeed} from '../site/window_feed_engine.js';
import {recordExerciseReview,applyExerciseReviews} from '../site/window_review_engine.js';
const games=JSON.parse(fs.readFileSync(new URL('../site/nfl_demo_window.json',import.meta.url))).games;
for(const game of games)test(`${game.id}: review invalidates after contrary evidence, correction and source staleness`,()=>{
 const feed=createGameFeed(game),baseline=replayGameFeed(feed,19),id=`${game.id}:C-03`;
 const reviews=recordExerciseReview(baseline,id,'needs_verification');
 assert.equal(applyExerciseReviews(baseline,reviews).candidates.find(c=>c.id===id).review.status,'current_exercise_review');
 const contrary=replayGameFeed(feed,21);
 assert.equal(applyExerciseReviews(contrary,reviews).candidates.find(c=>c.id===id).review.status,'evidence_changed_review_required');
 const second=recordExerciseReview(contrary,id,'exercise_follow_up',reviews),corrected=replayGameFeed(feed);
 assert.equal(applyExerciseReviews(corrected,second).candidates.find(c=>c.id===id).review.status,'evidence_changed_review_required');
 const third=recordExerciseReview(corrected,id,'dismissed_in_exercise',second);
 const exported=JSON.parse(JSON.stringify(applyExerciseReviews(corrected,third)));
 assert.equal(exported.reviewHistory.length,3);assert.equal(exported.candidates.find(c=>c.id===id).review.decision,'dismissed_in_exercise');
 assert(exported.reviewHistory.every(r=>r.dataMode==='synthetic_exercise'&&r.actor.includes('unauthenticated')));
 const stale=replayGameFeed(feed,25,new Date(Date.parse(corrected.clock)+31*60000).toISOString());
 assert.equal(applyExerciseReviews(stale,third).candidates.find(c=>c.id===id).review.status,'evidence_changed_review_required');
});
test('reject unknown decisions and live or cross-event review histories',()=>{
 const brief=replayGameFeed(createGameFeed(games[0]));
 assert.throws(()=>recordExerciseReview(brief,brief.candidates[0].id,'confirmed_threat'));
 const history=recordExerciseReview(brief,brief.candidates[0].id,'needs_verification');
 assert.throws(()=>applyExerciseReviews(replayGameFeed(createGameFeed(games[1])),history));
 assert.throws(()=>recordExerciseReview({...brief,dataMode:'live'},brief.candidates[0].id,'needs_verification'));
});
