import test from 'node:test';
import assert from 'node:assert/strict';
import {attentionSummary,humanLabel} from '../site/attention_summary.js';
test('coverage failures and empty feeds never become threats',()=>{
 assert.equal(attentionSummary({reviewQueue:{items:[{status:'source_check_needed',sourceUrl:'https://example.org'}]}}).items.length,0);
 assert.equal(attentionSummary({}).tone,'quiet');
});
test('source-backed concerns retain urgency without claiming confirmed threat',()=>{
 const result=attentionSummary({reviewQueue:{items:[{status:'unreviewed_source_cue',domain:'weather alert',sourceUrl:'https://weather.gov',trigger:'Warning'}]}});
 assert.equal(result.urgent.length,1);assert.match(result.label,/urgent weather concern/);
});
test('human labels hide implementation identifiers',()=>{
 assert.equal(humanLabel('EXACT_GAME_ID'),'Matches this scheduled game');
 assert.equal(humanLabel('updated_evidence'),'New information received');
});
