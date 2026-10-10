import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNflPublicReport} from '../site/nfl_public_report.js';

const bundle={schema:'event-atlas.public-evidence-bundle.v1',generatedAt:'2026-10-10T01:00:00Z',event:{title:'Away at Home',week:5,status:'scheduled',kickoff:'2026-10-11T20:00:00Z',sourceUrl:'https://example.org/game'},venue:{name:'Example Stadium',address:'Example, AZ, USA',lat:33.5,lon:-112.2},picture:{cueCounts:{weather:0,road:1,transit:0},cues:[{type:'road condition',title:'Listed lane work',basis:'Published window overlaps kickoff; impact unverified',sourceAt:'2026-10-10T00:00:00Z',sourceUrl:'https://example.org/road'}],sources:[{name:'Road conditions',state:'time screened',asOf:'2026-10-10T00:00:00Z',detail:'Proximity is not route impact.',sourceUrl:'https://example.org/road'}],gaps:['No verified stadium CCTV stream is connected.']},publicObservations:{nflHeadlines:{articles:[]},roads:[{kind:'Work zone',name:'101st Ave',agency:'AZTech WZDx',distanceKm:2,detail:'Lane work',startAt:null,endAt:null,sourceUrl:'https://example.org/road'}],cameras:[],weather:[],earthquakes:[],nationalAdvisory:{state:'current national snapshot',active:[],sourceUrl:'https://example.org/ntas'}},sourceSnapshots:{schedule:'2026-10-10T00:00:00Z',roads:'2026-10-10T00:00:00Z'},protectedPeople:{state:'not_collected_in_public_demo'},useLimit:'Analyst verification required.'};

test('public report binds event, current source cues, records, gaps, and source links without a threat claim',()=>{
  const report=buildNflPublicReport(bundle);
  for(const expected of ['Away at Home','2026-10-10T01:00:00.000Z','Listed lane work','AZTech WZDx','No verified stadium CCTV stream','https://example.org/road','Severity not assessed','NOAA SPC Day 1–3 outlook','NOAA WPC excessive-rainfall outlook','named-person records are not collected'])assert.ok(report.includes(expected),expected);
  assert.ok(!report.includes('Threat level:'));
  assert.ok(report.includes('[Publisher event record](https://example.org/game)'));
});

test('public report flattens untrusted publisher text and omits unsafe links',()=>{
  const altered=structuredClone(bundle);altered.picture.cues[0].title='Lane work\n## FALSE ASSESSMENT';altered.picture.cues[0].sourceUrl='javascript:alert(1)';
  const report=buildNflPublicReport(altered);
  assert.ok(report.includes('Lane work ## FALSE ASSESSMENT'));
  assert.ok(!report.includes('\n## FALSE ASSESSMENT'));
  assert.ok(!report.includes('javascript:'));
  assert.ok(report.includes('Source link unavailable'));
  assert.throws(()=>buildNflPublicReport({schema:'wrong'}),/required/);
});
