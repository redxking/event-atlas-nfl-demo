import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import net from 'node:net';
const config=JSON.parse(await fs.readFile('data/scan_targets.json','utf8'));
const execute=process.argv.includes('--execute');
const profiles={web:'80,443,8080,8443',mail:'25,465,587,993',dns:'53,853',remote_access:'22,3389,5900'};
function validTarget(s){return typeof s==='string'&&s.length<254&&(/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(s)||net.isIP(s)===4)}
if(!config.authorizationReference||!config.assetOwner||!config.windowStart||!config.windowEnd||!Array.isArray(config.targets)||!config.targets.length)throw Error('Populate the owner, written authorization reference, bounded scan window, and explicit targets before scanning.');
const now=Date.now(),start=Date.parse(config.windowStart),end=Date.parse(config.windowEnd);
if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)throw Error('Scan window must be valid and no more than 24 hours.');
for(const item of config.targets){if(!validTarget(item.target)||!profiles[item.profile])throw Error('Each target must be one explicit IPv4 address or hostname and a known technology profile. CIDRs, wildcards and URLs are not accepted.');}
if(execute&&(now<start||now>end))throw Error('Current time is outside the authorized scan window.');
await fs.mkdir('data/scan_results',{recursive:true});
for(const [i,item] of config.targets.entries()){
 const args=['-sT','-Pn','-n','-T2','--max-rate','5','--max-retries','1','--host-timeout','120s','--open','-p',profiles[item.profile],'-oX',`data/scan_results/target-${i+1}.xml`,item.target];
 console.log('nmap',args.join(' '));
 if(!execute)continue;
 await new Promise((resolve,reject)=>{const child=spawn('nmap',args,{stdio:'inherit',shell:false});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`nmap exit ${code}`)))});
}
if(!execute)console.log('Dry run only. Pass --execute within the authorized window.');
