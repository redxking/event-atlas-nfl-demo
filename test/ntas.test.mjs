import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const runner=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('ntas','scripts/sync_dhs_ntas.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
try:
 print(json.dumps(module.parse_feed(sys.stdin.buffer.read(),'2026-10-09T18:00:00Z')))
except Exception as error:
 print(type(error).__name__)
`;

function parse(xml){
  const result=spawnSync('python3',['-c',runner],{input:xml,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return result.stdout.trim();
}

test('DHS NTAS parser preserves scoped active advisory and excludes expired entries',()=>{
  const xml=`<alerts><alert start="2026/10/09 17:00" end="2026/10/10 17:00" type="Elevated Threat" link="https://www.dhs.gov/example"><summary>Test advisory</summary><locations><location>United States</location></locations><sectors><sector>Transportation</sector></sectors></alert><alert start="2026/10/08 17:00" end="2026/10/09 17:00" type="Expired" link="https://www.dhs.gov/expired"/></alerts>`;
  const result=JSON.parse(parse(xml));
  assert.equal(result.length,1);
  assert.equal(result[0].type,'Elevated Threat');
  assert.deepEqual(result[0].locations,['United States']);
  assert.deepEqual(result[0].sectors,['Transportation']);
});

test('DHS NTAS parser rejects unexpected feed structure and XML entities',()=>{
  assert.equal(parse('<not-alerts/>'),'ValueError');
  assert.equal(parse('<!DOCTYPE alerts [<!ENTITY x SYSTEM "file:///etc/passwd">]><alerts/>'),'ValueError');
});
