import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AnalystStore} from '../lib/analyst_store.mjs';

const [id]=process.argv.slice(2);
if(!id){console.error('Usage: npm run operator:revoke -- <id>');process.exit(2)}
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const store=new AnalystStore(path.join(root,'data/private/analyst.sqlite'));
try{const at=store.revokeOperator(id);console.log(`Operator ${id} revoked at ${at}`)}finally{store.close()}
