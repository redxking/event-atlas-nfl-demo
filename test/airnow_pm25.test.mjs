import test from 'node:test';
import assert from 'node:assert/strict';
import {airnowQueryUrl,buildAirnowSnapshot,selectAirnowForGame} from '../site/airnow_pm25.js';

const now=Date.parse('2026-10-10T12:00:00Z'),game={venue:{id:'x',lat:34,lon:-118}},url=airnowQueryUrl(now);
const header='Timestamp(UTC)\tLONGITUDE(deg)\tLATITUDE(deg)\tSTATION(-)\tpm25(ug/m3)\tSITE_NAME\n';
const line=(time,lon,lat,id,value)=>`${time}\t${lon}\t${lat}\t${id}\t${value}\t840060371103;88502;qc:0\n`;
test('EPA PM2.5 parser retains nearest recent station measurement with source time',()=>{
  const raw=header+line('2026-10-10T10:00:00-0000',-118.02,34.01,123,12.3)+line('2026-10-10T11:00:00-0000',-118.02,34.01,123,13.2)+line('2026-10-10T11:00:00-0000',-120,34,124,99);
  const snapshot=buildAirnowSnapshot(raw,[game],url,now),selected=selectAirnowForGame(game,snapshot,now);
  assert.equal(selected.state,'current_station_observation');
  assert.equal(selected.observation.stationId,'123');
  assert.equal(selected.observation.pm25UgM3,13.2);
  assert.equal(selected.observation.observedAt,'2026-10-10T11:00:00.000Z');
  assert.equal(selected.observation.sourceUrl,url);
});
test('EPA PM2.5 malformed, stale, and distant records cannot become current readings',()=>{
  assert.throws(()=>buildAirnowSnapshot('bad',[game],url,now));
  const snapshot=buildAirnowSnapshot(header+line('2026-10-10T06:00:00-0000',-118.02,34.01,123,12)+line('2026-10-10T11:00:00-0000',-120,34,124,99),[game],url,now);
  assert.equal(selectAirnowForGame(game,snapshot,now).state,'no_current_nearby_station');
  assert.equal(selectAirnowForGame(game,snapshot,now+13*3600000).state,'stale_or_unavailable');
  assert.equal(selectAirnowForGame(game,snapshot,now,'season_planning').state,'not_started');
});
