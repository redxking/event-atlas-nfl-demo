import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePublicEvidence} from '../lib/brief_change_detection.mjs';
import {compareBriefSnapshots} from '../lib/build_internal_case_brief.mjs';

const source=(name,state,url='https://example.gov/source')=>({name,state,sourceUrl:url});
const cue=(type,title,basis)=>({type,title,basis,sourceUrl:`https://example.gov/${title}`,sourceAt:'2026-10-11T18:00:00Z'});
const picture=(sources,cues=[],policeContext=null)=>({sources,cues,policeContext});
const brief=(eventPicture,options={})=>({event:{startsAtLocal:'2026-10-11T20:00:00Z'},nflContext:{status:options.status||'snapshot_available_unreviewed',evidence:{event:{kickoff:options.kickoff||'2026-10-11T20:00:00Z',timeTbd:false,status:'scheduled in source'},picture:eventPicture,sourceSnapshots:{weather:'2026-10-09T20:00:00Z'}}}});
const weather=cue('weather alert','NWS test alert','Sourced weather observation');
const roads=cue('road condition','Test closure','Published window overlaps kickoff');
const checked=[source('NWS point alerts','checked'),source('Road conditions','time screened'),source('Local police activity','delayed historical count checked','https://example.gov/police')];

test('new and changed review cues are surfaced only across comparable source checks',()=>{
  const before=brief(picture(checked,[weather]));
  const after=brief(picture(checked,[{...weather,basis:'Updated source description'},roads]));
  const result=comparePublicEvidence(before,after);
  assert.equal(result.state,'compared');
  assert.deepEqual(result.reviewCues.added.map(item=>item.title),['Test closure']);
  assert.deepEqual(result.reviewCues.changed.map(item=>item.current.basis),['Updated source description']);
  assert.deepEqual(result.reviewCues.noLongerPresent,[]);
  assert.deepEqual(result.reviewCues.notCompared,[]);
  assert.equal(result.policeAggregate.state,'not_comparable');
});

test('source failure or a changed kickoff does not claim a prior cue has resolved',()=>{
  const before=brief(picture(checked,[weather,roads]));
  const failed=brief(picture([source('NWS point alerts','source failed'),checked[1],checked[2]],[]));
  const result=comparePublicEvidence(before,failed);
  assert.deepEqual(result.sourceTransitions.map(item=>[item.name,item.from,item.to]),[['NWS point alerts','checked','source failed']]);
  assert.deepEqual(result.reviewCues.notCompared,['weather alert']);
  assert.deepEqual(result.reviewCues.noLongerPresent.map(item=>item.title),['Test closure']);
  const moved=comparePublicEvidence(before,brief(picture(checked,[]),{kickoff:'2026-10-11T21:00:00Z'}));
  assert.equal(moved.state,'partial');
  assert.deepEqual(moved.reviewCues.notCompared,['weather alert','road condition']);
  assert.deepEqual(moved.reviewCues.noLongerPresent,[]);
});

test('rolling police windows are never presented as a count trend',()=>{
  const prior={nearby:20,start:'2026-10-01',end:'2026-10-08',radiusKm:5};
  const current={...prior,nearby:24};
  const same=comparePublicEvidence(brief(picture(checked,[],prior)),brief(picture(checked,[],current)));
  assert.equal(same.policeAggregate.state,'same_window_count_changed');
  assert.equal(same.policeAggregate.previousCount,20);
  assert.equal(same.policeAggregate.currentCount,24);
  assert.match(same.policeAggregate.interpretation,/not a threat or trend assessment/);
  const shifted=comparePublicEvidence(brief(picture(checked,[],prior)),brief(picture(checked,[],{...current,start:'2026-10-02',end:'2026-10-09'})));
  assert.equal(shifted.policeAggregate.state,'different_windows');
  assert.equal(shifted.policeAggregate.previousCount,undefined);
});

test('saved brief baseline hash and evidence changes travel together',()=>{
  const previous={id:'saved-1',contentHash:'a'.repeat(64),brief:brief(picture(checked,[weather]))};
  const current=brief(picture(checked,[weather,roads]));
  const result=compareBriefSnapshots(previous,current);
  assert.equal(result.baseline,'saved-1');
  assert.equal(result.baselineContentHash,'a'.repeat(64));
  assert.equal(result.evidenceChanges.reviewCues.added[0].title,'Test closure');
  assert.equal(compareBriefSnapshots(null,current).evidenceChanges.state,'no_baseline');
});

test('Gillette transit alert revisions are compared only across complete checks',()=>{
  const checkedTransit=source('MBTA Foxboro station alerts','station alerts checked','https://api-v3.mbta.com/alerts?filter%5Bstop%5D=place-FS-0049');
  const old=cue('transit alert','Station shuttle','Published period overlaps event');
  const prior=brief(picture([...checked,checkedTransit],[old]));
  const next=brief(picture([...checked,checkedTransit],[{...old,title:'Revised station shuttle',sourceAt:'2026-10-11T19:00:00Z'}]));
  for(const item of [prior,next]){
    item.nflContext.evidence.venue={id:'3738'};
    item.nflContext.evidence.picture.transitContext={screenable:true,eventWindow:{start:'2026-10-11T16:00:00Z',end:'2026-10-12T01:00:00Z'}};
  }
  const changed=comparePublicEvidence(prior,next);
  assert.equal(changed.reviewCues.changed.length,1);
  assert.equal(changed.reviewCues.changed[0].current.title,'Revised station shuttle');
  const failed=brief(picture([...checked,source('MBTA Foxboro station alerts','source failed',checkedTransit.sourceUrl)],[]));
  failed.nflContext.evidence.venue={id:'3738'};
  const unavailable=comparePublicEvidence(prior,failed);
  assert.ok(unavailable.reviewCues.notCompared.includes('transit alert'));
  assert.equal(unavailable.reviewCues.noLongerPresent.length,0);
  const unscreenable=brief(picture([...checked,checkedTransit],[]));
  unscreenable.nflContext.evidence.venue={id:'3738'};
  unscreenable.nflContext.evidence.picture.transitContext={screenable:false,eventWindow:{start:null,end:null}};
  assert.ok(comparePublicEvidence(prior,unscreenable).reviewCues.notCompared.includes('transit alert'));
});
