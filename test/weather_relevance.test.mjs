import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWeatherContext} from '../site/weather_relevance.js';

const now=Date.parse('2026-10-11T14:00:00Z');
const game={kickoff:'2026-10-11T20:00:00Z',timeTbd:false,status:'scheduled'};
const feature=(properties)=>({properties:{status:'Actual',effective:'2026-10-11T19:00:00Z',ends:'2026-10-11T22:00:00Z',expires:'2026-10-12T01:00:00Z',severity:'Severe',urgency:'Expected',...properties}});

test('fresh point alert overlapping the game window is prioritized for review',()=>{
  const unrelated=feature({effective:'2026-10-12T04:00:00Z',ends:'2026-10-12T05:00:00Z'});
  const relevant=feature({event:'Severe Thunderstorm Warning'});
  const result=selectWeatherContext(game,[unrelated,relevant],now-60_000,now);
  assert.equal(result.state,'screened');
  assert.equal(result.candidateCount,1);
  assert.equal(result.alerts[0].feature,relevant);
  assert.equal(result.alerts[0].candidate,true);
});

test('source hazard end takes precedence over later message expiration',()=>{
  const expiredHazard=feature({effective:'2026-10-11T15:00:00Z',ends:'2026-10-11T15:30:00Z',expires:'2026-10-11T23:00:00Z'});
  assert.equal(selectWeatherContext(game,[expiredHazard],now,now).candidateCount,0);
});

test('a game within its illustrative five-hour post-kickoff interval remains eligible',()=>{
  const inProgress={...game,kickoff:'2026-10-11T12:00:00Z'};
  assert.equal(selectWeatherContext(inProgress,[feature({effective:'2026-10-11T13:00:00Z',ends:'2026-10-11T15:00:00Z'})],now,now).candidateCount,1);
});

test('stale, TBD, cancelled, nonactual, low urgency, and invalid windows do not yield candidates',()=>{
  const severe=feature({});
  const cases=[
    [game,[severe],now-6*60_000],
    [{...game,timeTbd:true},[severe],now],
    [{...game,status:'cancelled in source'},[severe],now],
    [game,[feature({status:'Test'})],now],
    [game,[feature({messageType:'Cancel'})],now],
    [game,[feature({urgency:'Future'})],now],
    [game,[feature({effective:null})],now],
    [game,[feature({ends:'2026-10-11T18:00:00Z',effective:'2026-10-11T19:00:00Z'})],now]
  ];
  for(const [event,features,at] of cases)assert.equal(selectWeatherContext(event,features,at,now).candidateCount,0);
});
