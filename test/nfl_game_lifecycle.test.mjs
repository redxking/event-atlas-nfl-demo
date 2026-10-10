import test from 'node:test';
import assert from 'node:assert/strict';
import {nflSourceStatus,includePublishedNflReport,publishedNflReportMode} from '../lib/nfl_game_lifecycle.mjs';

const now=Date.parse('2026-10-11T20:00:00Z');
const game=(status,kickoff)=>({status,kickoff:new Date(kickoff).toISOString(),timeTbd:false});

test('ESPN game states preserve active, final and disrupted status',()=>{
  assert.equal(nflSourceStatus({state:'pre',completed:false,name:'STATUS_SCHEDULED',description:'Scheduled'}),'scheduled in source; unreviewed');
  assert.equal(nflSourceStatus({state:'in',completed:false,name:'STATUS_IN_PROGRESS',description:'In Progress'}),'in progress in source');
  assert.equal(nflSourceStatus({state:'post',completed:true,name:'STATUS_FINAL',description:'Final'}),'completed in source');
  assert.match(nflSourceStatus({state:'pre',completed:false,name:'STATUS_POSTPONED',description:'Postponed'}),/Postponed/);
  assert.equal(nflSourceStatus({state:'in',completed:false,name:'STATUS_DELAYED',description:'Delayed'}),'source status Delayed');
});

test('every upcoming scheduled game gets a planning report and near-term games get active checks',()=>{
  assert.equal(publishedNflReportMode(game('scheduled in source; unreviewed',now+30*86400000),now),'season_planning');
  assert.equal(publishedNflReportMode({...game('scheduled in source; unreviewed',now+30*86400000),timeTbd:true},now),'season_planning');
  assert.equal(publishedNflReportMode(game('scheduled in source; unreviewed',now+2*86400000),now),'near_term_monitoring');
  assert.equal(publishedNflReportMode(game('completed in source',now-20*3600000),now),'near_term_monitoring');
  assert.equal(publishedNflReportMode(game('completed in source',now-30*3600000),now),null);
  assert.equal(publishedNflReportMode(game('source status Postponed',now+30*86400000),now),null);
});

test('published reports survive the active game and bounded postgame period',()=>{
  assert.equal(includePublishedNflReport(game('scheduled in source; unreviewed',now+2*86400000),now),true);
  assert.equal(includePublishedNflReport(game('in progress in source',now-3*3600000),now),true);
  assert.equal(includePublishedNflReport(game('completed in source',now-20*3600000),now),true);
  assert.equal(includePublishedNflReport(game('completed in source',now-25*3600000),now),false);
  assert.equal(includePublishedNflReport(game('source status Postponed',now+2*3600000),now),false);
  assert.equal(includePublishedNflReport({...game('scheduled in source; unreviewed',now+3600000),timeTbd:true},now),false);
});
