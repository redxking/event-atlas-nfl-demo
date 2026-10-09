import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AnalystStore} from '../lib/analyst_store.mjs';

const [id,role,...nameParts]=process.argv.slice(2);
if(!id||!role||!nameParts.length){console.error('Usage: npm run operator:create -- <id> <analyst|reviewer> <display name>');process.exit(2)}
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const store=new AnalystStore(path.join(root,'data/private/analyst.sqlite'));
try{const token=store.createOperator(id,nameParts.join(' '),role);console.log(`Operator ${id} (${role}) created. Copy this token now; it will not be shown again:\n${token}`)}finally{store.close()}
