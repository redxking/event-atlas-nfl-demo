import test from 'node:test';
import assert from 'node:assert/strict';
import {selectAz511PublicAlerts,az511PublicAlertsUrl} from '../site/az511_public_alerts.js';

const now=Date.parse('2026-10-10T12:00:00Z');
const game={id:'nfl:401872991',kickoff:'2026-10-11T20:25:00Z',timeTbd:false,venue:{id:'3970'}};
const entry={title:'Weekend freeway closures/restrictions in Phoenix area',notes:'PHOENIX - restrictions Friday, Oct. 9-Monday, Oct. 12. EB L-101 (Agua Fria Freeway) closed between 75th and 51st avenues.',updatedAt:'2026-10-08T20:45:00Z',localDateStart:'2026-10-09',localDateEnd:'2026-10-12',sourceTextSha256:'a'.repeat(64),sourceUrl:az511PublicAlertsUrl};
const snapshot={schema:'event-atlas.az511-public-alerts.v1',status:'ok',checkedAt:'2026-10-10T11:55:00Z',sourceUrl:az511PublicAlertsUrl,entries:[entry]};

test('AZ511 public notice is matched to Arizona local game date as regional context',()=>{
  const result=selectAz511PublicAlerts(game,snapshot,now);
  assert.equal(result.state,'current_date_matched_regional_notice');
  assert.equal(result.entries.length,1);
  assert.equal(result.entries[0].regionalCorridorMention,true);
});

test('AZ511 notice does not match wrong date, venue, or stale check',()=>{
  assert.equal(selectAz511PublicAlerts({...game,kickoff:'2026-10-18T20:25:00Z'},snapshot,now).state,'outside_near_term_arizona_scope');
  assert.equal(selectAz511PublicAlerts({...game,venue:{id:'3493'}},snapshot,now).state,'outside_near_term_arizona_scope');
  assert.equal(selectAz511PublicAlerts(game,{...snapshot,checkedAt:'2026-10-10T08:00:00Z'},now).state,'stale_or_unavailable');
  assert.equal(selectAz511PublicAlerts(game,{...snapshot,entries:[{...entry,notes:'unrelated'}]},now).state,'stale_or_unavailable');
});
