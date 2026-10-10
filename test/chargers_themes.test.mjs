import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChargersThemes,selectChargersTheme} from '../site/chargers_themes.js';

const checkedAt='2026-10-10T16:00:00Z';
const html=`<script>{"datePublished":"2026-09-08T21:14:10.849Z"}</script><table><thead><tr><th>Game</th><th>Game Theme</th><th>Presenting Partner</th></tr></thead><tbody>${[
  ['1','Cardinals','Kickoff',''],['2','Raiders','Puro Chargers','Verizon'],['5','Broncos','Crucial Catch','UCLA Health'],['9','Texans','Legends Weekend','Mazda'],['11','Jets','Salute to Service','American Airlines'],['12','Patriots','Super Chargers','Toyota'],['15','49ers','Winter Wonderland',''],['17','Chiefs','Fan Appreciation','']
].map(([week,opponent,theme,partner])=>`<tr><td>Week ${week} vs. ${opponent}</td><td>${theme}</td><td>${partner}</td></tr>`).join('')}</tbody></table>`;
const game={week:5,venue:{id:'7065'},teams:[{name:'Denver Broncos',role:'away'},{name:'Los Angeles Chargers',role:'home'}]};

test('official Chargers theme table joins only exact home week and opponent',()=>{
  const snapshot=parseChargersThemes(html,checkedAt);
  const selected=selectChargersTheme(game,snapshot,Date.parse(checkedAt)+1000);
  assert.equal(snapshot.themes.length,8);
  assert.equal(selected.state,'published_game_theme');
  assert.equal(selected.theme,'Crucial Catch');
  assert.equal(selected.presentingPartner,'UCLA Health');
  assert.equal(selectChargersTheme({...game,week:6},snapshot,Date.parse(checkedAt)+1000).state,'no_exact_match');
  assert.equal(selectChargersTheme({...game,teams:[{name:'Las Vegas Raiders',role:'away'},{name:'Los Angeles Chargers',role:'home'}]},snapshot,Date.parse(checkedAt)+1000).state,'no_exact_match');
  assert.equal(selectChargersTheme({...game,venue:{id:'4738'}},snapshot,Date.parse(checkedAt)+1000).state,'outside_source_event');
});

test('stale or malformed club theme source cannot become a published event claim',()=>{
  const snapshot=parseChargersThemes(html,checkedAt);
  assert.equal(selectChargersTheme(game,snapshot,Date.parse(checkedAt)+25*3600000).state,'unavailable');
  assert.throws(()=>parseChargersThemes(html.replace('Game Theme','Other')),/table unavailable/);
  assert.throws(()=>parseChargersThemes(html.replace('Week 5 vs. Broncos','Week 2 vs. Broncos')),/Duplicate/);
});
