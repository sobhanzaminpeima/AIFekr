import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';

// All writes are scoped to a fresh fixture directory; no configured DB is used.
const root=resolve('.');await mkdir(join(root,'tmp'),{recursive:true});
const fixture=await mkdtemp(join(root,'tmp','mobile-http-'));
const database=join(fixture,'fixture.db');await writeFile(database,'');
const databaseUrl=`file:${database.replaceAll('\\','/')}`;
let schema=await readFile(join(root,'prisma','schema.prisma'),'utf8');
schema=schema.replace(/^\s*mobileSessions MobileSession\[\]\s*$/m,'').replace(/^\s*mobileRequests MobileRequest\[\]\s*$/m,'').replace(/model MobileSession \{[\s\S]*?\n\}/,'').replace(/model MobileRequest \{[\s\S]*?\n\}/,'').replace(/model MobileStorePurchase \{[\s\S]*?\n\}/,'');
const schemaPath=join(fixture,'before-mobile.prisma');await writeFile(schemaPath,schema);
const env={...process.env,DATABASE_URL:databaseUrl,JWT_SECRET:randomBytes(32).toString('hex'),MOBILE_API_ENABLED:'true',MOBILE_STORE_MODE:'disabled',NEXT_DIST_DIR:join('tmp',fixture.split(/[\\/]/).at(-1),'next'),NEXT_TELEMETRY_DISABLED:'1'};
const setup=spawnSync(process.execPath,[join(root,'node_modules/prisma/build/index.js'),'db','push','--schema',schemaPath,'--skip-generate'],{env,encoding:'utf8'});
assert.equal(setup.status,0,`Fixture setup failed: ${setup.stderr}`);
const db=new PrismaClient({datasources:{db:{url:databaseUrl}}});
const proofs=[];
for(const migration of ['20261013210000_mobile_sessions','20261013213000_mobile_requests','20261014180000_mobile_push','20261015150000_mobile_store']){
 const sql=await readFile(join(root,'prisma','migrations',migration,'migration.sql'),'utf8');
 for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
 proofs.push(`Applied actual additive SQL: ${migration}`);
}
const password=randomBytes(24).toString('hex');
const user=await db.user.create({data:{email:'mobile-http-fixture@example.test',name:'HTTP smoke fixture',passwordHash:await bcrypt.hash(password,10),language:'en',credits:123}});
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';server.stdout.on('data',chunk=>{logs+=chunk.toString();});server.stderr.on('data',chunk=>{logs+=chunk.toString();});
async function json(path,body,token,method=body?'POST':'GET'){
 const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',Cookie:'lang=en',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 return {response,body:await response.json().catch(()=>null)};
}
try{
 const deadline=Date.now()+120000;let started=false;
 while(Date.now()<deadline){try{await fetch(origin+'/api/mobile/v1/session',{method:'GET',signal:AbortSignal.timeout(5000)});started=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(started,'Local Next server did not become ready');
 const wrong=await json('/api/mobile/v1/session',{email:user.email,password:'incorrect'});assert.equal(wrong.response.status,401);proofs.push('Wrong password rejected over real HTTP');
 const login=await json('/api/mobile/v1/session',{email:user.email,password});assert.equal(login.response.status,200);assert.equal(login.body.expiresIn,900);assert.equal(login.response.headers.get('set-cookie'),null);assert.equal(login.response.headers.get('cache-control'),'no-store');proofs.push('Native login issues short-lived credentials without browser cookies');
 const status=await json('/api/mobile/v1/status');assert.equal(status.response.status,200);assert.equal(status.body.apiVersion,1);proofs.push('Deployment readiness status contract responds over real HTTP');
 const billing=await json('/api/mobile/v1/billing',null,login.body.accessToken);assert.equal(billing.response.status,200);assert.equal(billing.body.enabled,false);assert.deepEqual(billing.body.products,[]);proofs.push('Unconfigured store checkout remains disabled over real authenticated HTTP');
 const profile=await json('/api/user/profile',null,login.body.accessToken);assert.equal(profile.response.status,200);assert.equal(profile.body.user.displayCredits,123);proofs.push('Real Bearer request reaches profile and spendable credit rules');
 const rotated=await json('/api/mobile/v1/session/refresh',{refreshToken:login.body.refreshToken});assert.equal(rotated.response.status,200);assert.notEqual(rotated.body.refreshToken,login.body.refreshToken);proofs.push('Refresh rotates over real HTTP');
 const devices=await json('/api/mobile/v1/session/devices',null,rotated.body.accessToken);assert.equal(devices.response.status,200);assert.equal(devices.body.sessions.length,1);
 const revoke=await json('/api/mobile/v1/session',{refreshToken:rotated.body.refreshToken},null,'DELETE');assert.equal(revoke.response.status,200);
 assert.equal((await json('/api/user/profile',null,rotated.body.accessToken)).response.status,401);proofs.push('Logout invalidates previously issued native access at server');
 const second=await json('/api/mobile/v1/session',{email:user.email,password});const third=await json('/api/mobile/v1/session/refresh',{refreshToken:second.body.refreshToken});assert.equal(third.response.status,200);
 assert.equal((await json('/api/mobile/v1/session/refresh',{refreshToken:second.body.refreshToken})).response.status,401);
 assert.equal((await json('/api/user/profile',null,third.body.accessToken)).response.status,401);proofs.push('Replayed valid refresh secret revokes the token family over HTTP');
 await writeFile(join(fixture,'result.json'),JSON.stringify({status:'PASS',proofs,fixture},null,2));console.log(JSON.stringify({status:'PASS',proofs,fixture},null,2));
}catch(error){await writeFile(join(fixture,'server.log'),logs);throw error;}
finally{
 if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill('SIGTERM');
 await db.$disconnect();
}
