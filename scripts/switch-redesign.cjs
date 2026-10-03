// Run on the VPS only after the staged build and preview pass.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
require(require.resolve('@next/env', {paths:[require.resolve('next/package.json')]})).loadEnvConfig(process.cwd());
(async()=>{
 const stage=process.cwd();
 if(stage !== '/var/www/aifekr-release-20261003' || !fs.existsSync(path.join(stage,'.next/BUILD_ID'))) throw new Error('Expected completed staging build');
 const processes=JSON.parse(execFileSync('pm2',['jlist'],{encoding:'utf8'}));
 const entry=processes.find(p=>p.name==='ai-platform');if(!entry)throw new Error('Live process missing');
 const e=entry.pm2_env;
 const backup=path.join('/var/www/ai-platform','.deploy-backup-20261003-'+Date.now());fs.mkdirSync(backup,{mode:0o700});
 const config=cwd=>({apps:[{name:'ai-platform',script:e.pm_exec_path,args:e.args,cwd,interpreter:e.exec_interpreter,exec_mode:'fork',env:e.env||{}}]});
 fs.writeFileSync(path.join(backup,'rollback.ecosystem.json'),JSON.stringify(config(e.pm_cwd)),{mode:0o600});
 fs.writeFileSync(path.join(backup,'release.ecosystem.json'),JSON.stringify(config(stage)),{mode:0o600});
 const url=process.env.DATABASE_URL;if(!url?.startsWith('file:'))throw new Error('Expected SQLite production database');
 const database=path.resolve(fs.realpathSync(path.join(stage,'prisma')),url.slice(5));
 const Database=require('better-sqlite3');const db=new Database(database,{readonly:true});await db.backup(path.join(backup,'production.db'));db.close();
 fs.writeFileSync(path.join(backup,'student-packages.json'),JSON.stringify([]),{mode:0o600});
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","db","push","--skip-generate"],{cwd:stage,stdio:"inherit"});
 const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();const previous=await p.package.findMany({where:{planCode:{startsWith:'STUDENT_'}}});await p.$disconnect();fs.writeFileSync(path.join(backup,'student-packages.json'),JSON.stringify(previous),{mode:0o600});
 execFileSync(process.execPath,['scripts/seed-bank-settings.cjs'],{cwd:stage,stdio:'inherit'});
 execFileSync(process.execPath,['scripts/seed-student-package.cjs'],{cwd:stage,stdio:'inherit'});
 fs.appendFileSync(path.join(stage,'.env.local'),'\nTELEGRAM_NOTIFICATIONS_SINCE='+JSON.stringify(new Date().toISOString())+'\n');
 execFileSync('pm2',['startOrReload',path.join(backup,'release.ecosystem.json'),'--only','ai-platform','--update-env'],{stdio:'inherit'});
 let healthy=false;
 for(let attempt=0;attempt<10;attempt++) { try { const response=await fetch('http://127.0.0.1:3000/pricing',{signal:AbortSignal.timeout(10000)});if(response.ok){healthy=true;break;} }catch{} await new Promise(r=>setTimeout(r,1000)); }
 if(!healthy){execFileSync('pm2',['startOrReload',path.join(backup,'rollback.ecosystem.json'),'--only','ai-platform','--update-env'],{stdio:'inherit'});throw new Error('Health check failed; previous process configuration restored.');}
 fs.writeFileSync('/etc/cron.d/aifekr-payment-notifications',`*/5 * * * * root cd ${stage} && /usr/bin/node scripts/payment-notifications-cron.cjs >> /var/log/aifekr-payment-notifications.log 2>&1\n`,{mode:0o644});
 execFileSync('pm2',['save'],{stdio:'inherit'});
 fs.writeFileSync('/tmp/aifekr-redesign-backup-path',backup,{mode:0o600});
 console.log('Release switched; rollback configuration and consistent SQLite snapshot: '+backup);
})().catch(error=>{console.error(error.message);process.exitCode=1});
