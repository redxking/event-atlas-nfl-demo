import {readFile} from 'node:fs/promises';
import {verifyPublishedReports} from '../lib/verify_published_reports.mjs';
const site=new URL('../site/',import.meta.url);
const index=JSON.parse(await readFile(new URL('reports/index.json',site)));
const schedule=JSON.parse(await readFile(new URL('nfl.json',site)));
console.log(JSON.stringify(await verifyPublishedReports(index,schedule,path=>readFile(new URL(path,site)))));
