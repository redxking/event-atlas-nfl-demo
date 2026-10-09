import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileEventSnapshot} from '../lib/event_snapshot.mjs';

const source=(id,status='ok')=>({id,status,retrievedAt:'2026-10-09T12:00:00Z'});
const event=(id,sourceId='one',startsAtLocal='2026-10-20T19:00:00')=>({id,sourceId,title:id,startsAtLocal,status:'scheduled',sourcePlace:{name:'Hall',address:'1 Main St',lat:40,lon:-75},placeId:'hall'});
const prior={retrievedAt:'2026-10-08T12:00:00Z',sources:[source('one'),source('two')],events:[event('rescheduled'),event('missing'),event('expired','one','2026-10-01'),event('retained','two')],places:[{id:'hall'}]};

test('event reconciliation records reschedules, source disappearance and new listings',()=>{const moved={...event('rescheduled'),startsAtLocal:'2026-10-21T19:00:00',sourcePlace:{...event('rescheduled').sourcePlace,address:'2 Main St'}};const out=reconcileEventSnapshot(prior,{retrievedAt:'2026-10-09T12:00:00Z',fromDate:'2026-10-09',sources:[source('one'),source('two','failed')],events:[moved,event('new')],places:[{id:'hall'}]});assert.equal(out.events.some(e=>e.id==='retained'),true);assert.equal(out.sources.find(s=>s.id==='two').status,'stale_retained');assert.deepEqual(out.changeSet.retainedSources,['two']);assert.deepEqual(out.changeSet.items.map(x=>[x.eventId,x.kind]),[['rescheduled','changed'],['new','added'],['missing','missing_from_current_feed']]);assert.deepEqual(out.changeSet.items[0].changedFields,['startsAtLocal','sourcePlace']);assert.equal(out.changeSet.items.some(x=>x.eventId==='expired'),false)});
test('zero-record source response is quarantined when future events existed',()=>{const out=reconcileEventSnapshot(prior,{retrievedAt:'2026-10-09T12:00:00Z',sources:[source('one'),source('two','failed')],events:[],places:[]});assert.equal(out.events.length,4);assert.equal(out.sources.find(s=>s.id==='one').status,'stale_retained');assert.equal(out.changeSet.items.length,0)});

import {reconcileVotingSnapshot,projectVotingSite,caseVotingDrift} from '../lib/voting_snapshot.mjs';
const site=(id,sourceId='north')=>({id,sourceId,name:id,type:'early_vote_center',jurisdiction:'NC',county:'Sample',city:'Town',street:'1 Main St',status:'Published',datesOpen:'October 15',hours:'8 AM–5 PM',retrievedAt:'2026-10-08T12:00:00Z'});
test('voting reconciliation distinguishes updates from missing rows and stale feeds',()=>{
  const before={retrievedAt:'2026-10-08T12:00:00Z',sources:[source('north'),source('south')],locations:[site('changed'),site('missing'),site('retained','south')]};
  const after={retrievedAt:'2026-10-09T12:00:00Z',sources:[source('north'),source('south','stale_retained')],locations:[{...site('changed'),street:'2 Main St',retrievedAt:'2026-10-09T12:00:00Z'},site('new'),site('retained','south')]};
  const out=reconcileVotingSnapshot(before,after);
  assert.deepEqual(out.changeSet.items.map(change=>[change.siteId,change.kind]),[['changed','changed'],['new','added'],['missing','missing_from_current_feed']]);
  assert.deepEqual(out.changeSet.items[0].changedFields,['street']);
  assert.deepEqual(out.changeSet.retainedSources,['south']);
  assert.equal(out.changeSet.items.some(change=>change.siteId==='retained'),false);
  assert.equal(reconcileVotingSnapshot(after,{...after,retrievedAt:'2026-10-10T12:00:00Z'}).changeSet.items.length,0);
});
test('case source comparison flags changed fields and stale connectors',()=>{
  const intake={operationalSnapshot:projectVotingSite(site('one'))};
  assert.equal(caseVotingDrift(intake,site('one'),source('north')).status,'unchanged_since_intake');
  const changed=caseVotingDrift(intake,{...site('one'),hours:'9 AM–6 PM'},source('north'));
  assert.equal(changed.status,'changed_since_intake');assert.deepEqual(changed.changedFields,['hours']);
  assert.equal(caseVotingDrift(intake,site('one'),source('north','stale_retained')).status,'source_stale');
  assert.equal(caseVotingDrift(intake,null,source('north')).status,'missing_from_current_snapshot');
  assert.equal(caseVotingDrift({},site('one'),source('north')).status,'baseline_unavailable');
});
