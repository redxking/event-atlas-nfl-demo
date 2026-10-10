import test from 'node:test';
import assert from 'node:assert/strict';
import {glendaleCallsQueries,summarizeGlendaleCalls} from '../site/glendale_public_calls.js';

test('Glendale query keeps only a seven-day historical stadium ZIP count',()=>{
  const query=glendaleCallsQueries(Date.parse('2026-10-10T12:00:00Z'));
  const count=new URL(query.countUrl);
  assert.equal(query.start,'2026-10-01');
  assert.equal(query.end,'2026-10-08');
  assert.match(count.searchParams.get('where'),/ZipCode = '85305'/);
  assert.equal(count.searchParams.get('returnCountOnly'),'true');
  assert.equal(count.searchParams.has('outFields'),false);
});

test('Glendale count fails closed on stale, malformed, or future source times',()=>{
  const now=Date.parse('2026-10-10T12:00:00Z'),query=glendaleCallsQueries(now);
  const good={features:[{attributes:{max_loaded:now-24*3600000,max_call:now-35*3600000}}]};
  const result=summarizeGlendaleCalls({count:321},good,query,now);
  assert.equal(result.status,'delayed_historical');
  assert.equal(result.nearby,321);
  assert.equal(result.zip,'85305');
  assert.equal(summarizeGlendaleCalls({count:321},{features:[{attributes:{max_loaded:now-80*3600000,max_call:now-100*3600000}}]},query,now).status,'stale_source');
  assert.throws(()=>summarizeGlendaleCalls({count:-1},good,query,now));
  assert.throws(()=>summarizeGlendaleCalls({count:0},{features:[{attributes:{max_loaded:now+3600000,max_call:now}}]},query,now));
});
