import fs from 'node:fs/promises';
import path from 'node:path';
import {syncNflGameArticles} from '../lib/nfl_game_article_source.mjs';

const site=path.resolve(import.meta.dirname,'../site');
const schedule=JSON.parse(await fs.readFile(path.join(site,'nfl.json'),'utf8'));
if(schedule?.source?.status!=='ok'||!Array.isArray(schedule.games)||Date.now()-Date.parse(schedule.builtAt)>12*3600000)throw Error('Fresh NFL schedule required');
const snapshot=await syncNflGameArticles(schedule.games);
await fs.writeFile(path.join(site,'game_articles.json'),JSON.stringify(snapshot)+'\n');
console.log(`ESPN game articles: ${snapshot.status}; ${snapshot.checkedGames-snapshot.failedGames}/${snapshot.checkedGames} checked; ${Object.values(snapshot.byGame).filter(item=>item.article).length} current headlines`);
