import {writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {existsSync} from 'node:fs';
const checks=[];
function record(name,passed,detail){checks.push({name,passed,detail});}
let origin;
try{const value=new URL(process.env.EXPO_PUBLIC_API_URL||'');if(value.protocol!=='https:'||value.username||value.password||value.pathname!=='/'||value.search||value.hash||value.hostname.endsWith('.example.com')||value.hostname==='example.com')throw Error();origin=value.origin;record('httpsBackendOrigin',true,origin);}catch{record('httpsBackendOrigin',false,'Set the real deployed HTTPS API origin; placeholder values are rejected.');}
if(origin){try{const response=await fetch(origin+'/api/mobile/v1/status',{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});const body=await response.json();record('deployedMobileApi',response.ok&&body.service==='aifekr-mobile'&&body.apiVersion===1&&body.enabled===true,`HTTP ${response.status}; expected mobile API v1 status contract`);}catch{record('deployedMobileApi',false,'TLS, timeout, redirect or status contract verification failed.');}}
const configResult=spawnSync(process.execPath,[resolve('mobile/node_modules/expo/bin/cli'),'config','--type','public','--json'],{cwd:resolve('mobile'),encoding:'utf8',maxBuffer:10*1024*1024});
try{const config=JSON.parse(configResult.stdout);record('identifiers',config.android?.package==='com.aifekr.app'&&config.ios?.bundleIdentifier==='com.aifekr.app','Expected approved identifiers');record('easProject',config.extra?.eas?.projectId==='ac16be93-5a37-495a-a6af-e93e83592f40','Expected user-owned EAS project');}catch{record('nativeConfiguration',false,'Expo configuration could not be resolved');}
const npmCandidates=[process.env.npm_execpath,resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
const npmCli=npmCandidates.find(path=>existsSync(path));
if(npmCli){const audit=spawnSync(process.execPath,[npmCli,'audit','--json'],{cwd:resolve('mobile'),encoding:'utf8',maxBuffer:10*1024*1024});try{const result=JSON.parse(audit.stdout),v=result.metadata.vulnerabilities;record('dependencyAudit',v.high===0&&v.critical===0,`${v.high} high; ${v.critical} critical`);}catch{record('dependencyAudit',false,'Audit could not be verified');}}else record('dependencyAudit',false,'npm CLI unavailable; dependency security remains unverified');
record('liveBilling',false,'Live billing, refund reconciliation and actual store acceptance remain unverified. Current code supports Google Play sandbox consumable credits only.');
record('deviceAcceptance',false,'Attach actual Android/iOS acceptance evidence; a signed build alone does not prove device behavior.');
record('providerAcceptance',false,'Full end-to-end acceptance across AI/media/OCR, push, health and payments is still incomplete. Individual successful chat checks do not establish complete provider acceptance.');
const report={generatedAt:new Date().toISOString(),ready:checks.every(c=>c.passed),checks};await mkdir('output/mobile',{recursive:true});await writeFile('output/mobile/release-preflight.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.ready?0:1;
